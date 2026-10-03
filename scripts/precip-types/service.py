"""NOAA MRMS categorical masks for the EZCLICK local map preview.
Classification follows https://www.nssl.noaa.gov/projects/mrms/operational/tables.php
0 unknown/no precip/no coverage; 1 rain; 2 snow; 3 hail. Never infer freezing rain.
"""
import datetime as dt
import gzip
import json
import math
import os
from pathlib import Path
import re
import tempfile
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import winddata
import forecastdata
import numpy as np
from osgeo import gdal
from PIL import Image

gdal.UseExceptions()
gdal.SetCacheMax(96*1024*1024)
ROOT=Path('/data'); ROOT.mkdir(exist_ok=True)
BASE='https://noaa-mrms-pds.s3.amazonaws.com/'
NS={'s':'http://s3.amazonaws.com/doc/2006-03-01/'}
BBOX=(-130,22,-60,52)
state={'frames':[],'updatedAt':None,'error':'Initializing'}
lock=threading.Lock()
def read(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'EZCLICK-weather-prototype/1.0'}),timeout=45) as r:return r.read()
def catalog():
    keys=[]
    for day in [dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=n) for n in (0,1)]:
        prefix='CONUS/PrecipFlag_00.00/'+day.strftime('%Y%m%d')+'/'
        root=ET.fromstring(read(BASE+'?list-type=2&prefix='+prefix))
        keys.extend(e.text for e in root.findall('s:Contents/s:Key',NS))
    frames=[]
    for key in keys:
        m=re.search(r'(\d{8})-(\d{6})\.grib2\.gz$',key)
        if not m:continue
        date=dt.datetime.strptime(''.join(m.groups()),'%Y%m%d%H%M%S').replace(tzinfo=dt.timezone.utc)
        epoch=int(date.timestamp()*1000)
        if time.time()*1000-epoch<4*3600000:frames.append((epoch,key))
    # One categorical mask per 6 minutes, newest first; match tolerance is 4 minutes.
    slots={}
    for stamp,key in sorted(frames):slots[stamp//360000]=(stamp,key)
    return sorted(slots.values(),reverse=True)
def make_mask(stamp,key):
    path=ROOT/(str(stamp)+'.png')
    if path.exists():return path
    with tempfile.TemporaryDirectory() as folder:
        raw=Path(folder)/'input.grib2'
        raw.write_bytes(gzip.decompress(read(BASE+key)))
        to_y=lambda lat:6378137*math.log(math.tan(math.pi/4+math.radians(lat)/2))
        bounds=[6378137*math.radians(-130),to_y(22),6378137*math.radians(-60),to_y(52)]
        ds=gdal.Warp('',str(raw),format='MEM',dstSRS='EPSG:3857',outputBounds=bounds,width=1536,height=900,resampleAlg='near',dstNodata=-3,outputType=gdal.GDT_Int16)
        values=ds.GetRasterBand(1).ReadAsArray();ds=None
        mask=np.zeros(values.shape,dtype=np.uint8)
        mask[np.isin(values,[1,6,10,91,96])]=1
        mask[values==3]=2
        mask[values==7]=3
        Image.fromarray(mask).save(str(path)+'.tmp',format='PNG')
        os.replace(str(path)+'.tmp',path)
        counts={str(n):int((mask==n).sum()) for n in (0,1,2,3)}
        (ROOT/(str(stamp)+'.json')).write_text(json.dumps(counts))
        print('mask',stamp,counts,flush=True)
    return path

def publish(error=None):
    frames=[]
    for path in sorted(ROOT.glob('*.png')):
        if not path.stem.isdigit():continue
        stamp=int(path.stem)
        if time.time()*1000-stamp>5*3600000:
            path.unlink(missing_ok=True);path.with_suffix('.json').unlink(missing_ok=True);continue
        frames.append({'time':stamp,'url':'/mask/'+path.name})
    with lock:state.update(frames=frames,updatedAt=int(time.time()*1000),error=error)
def worker():
    while True:
        try:
            for stamp,key in catalog():
                make_mask(stamp,key);publish()
        except Exception as e:
            print(type(e).__name__,str(e),flush=True);publish('Classification feed temporarily unavailable')
        time.sleep(120)
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        origin=self.headers.get('Origin','')
        if origin in ('http://127.0.0.1:5174','http://127.0.0.1:5173','http://localhost:5174','http://localhost:5173'):
            self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Vary','Origin')
        super().end_headers()
    def do_GET(self):
        if self.path.split('?')[0]=='/forecast/frames':
            body=json.dumps(forecastdata.catalog()).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
        elif re.fullmatch(r'/forecast/v2/\d{13}_\d{13}\.png',self.path):
            path=forecastdata.ROOT/self.path.rsplit('/',1)[1]
            if not path.exists():self.send_error(404);return
            self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('Cache-Control','public,max-age=86400');self.end_headers();self.wfile.write(path.read_bytes())
        elif re.fullmatch(r'/forecast/\d{13}_\d{13}\.png',self.path):
            path=Path('/data/forecast')/self.path.rsplit('/',1)[1]
            if not path.exists():self.send_error(404);return
            self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('Cache-Control','public,max-age=86400');self.end_headers();self.wfile.write(path.read_bytes())
        elif self.path.split('?')[0]=='/wind/frames':
            body=json.dumps(winddata.catalog()).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
        elif re.fullmatch(r'/wind/\d{13}_\d{13}\.bin',self.path):
            path=winddata.ROOT/(self.path.rsplit('/',1)[1]+'.gz')
            if not path.exists():self.send_error(404);return
            self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Encoding','gzip');self.send_header('Cache-Control','public,max-age=86400');self.end_headers();self.wfile.write(path.read_bytes())
        elif self.path.split('?')[0]=='/frames':
            with lock:body=json.dumps({**state,'source':'NOAA MRMS PrecipFlag','bbox':BBOX,'width':1536,'height':900,'maxOffsetMs':240000}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
        elif re.fullmatch(r'/mask/\d{13}\.png',self.path):
            path=ROOT/self.path.rsplit('/',1)[1]
            if not path.exists():self.send_error(404);return
            self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('Cache-Control','public,max-age=3600');self.end_headers();self.wfile.write(path.read_bytes())
        else:self.send_error(404)
winddata.publish()
forecastdata.start()
threading.Thread(target=worker,daemon=True).start()
ThreadingHTTPServer(('0.0.0.0',8766),Handler).serve_forever()


