"""Real NOAA GFS 10 m U/V fields, reduced from 0.25 to a fixed 0.5 degree grid."""
import datetime as dt
import gzip
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import urllib.request
import numpy as np
from osgeo import gdal

ROOT=Path('/data/wind');ROOT.mkdir(exist_ok=True)
BASE='https://noaa-gfs-bdp-pds.s3.amazonaws.com/'
state={'frames':[],'error':'Initializing'}
lock=threading.Lock()

def read(url,headers=None):
    req=urllib.request.Request(url,headers={'User-Agent':'EZCLICK-weather/1.0',**(headers or {})})
    with urllib.request.urlopen(req,timeout=45) as r:
        if headers and 'Range' in headers and r.status!=206:raise ValueError('Range request not honoured')
        return r.read()

def produce(run,valid):
    ident=f'{int(run.timestamp()*1000)}_{int(valid.timestamp()*1000)}'
    meta=ROOT/(ident+'.json')
    if meta.exists():return
    lead=int((valid-run).total_seconds()/3600)
    url=BASE+run.strftime('gfs.%Y%m%d/%H/atmos/gfs.t%Hz.pgrb2.0p25.')+f'f{lead:03}'
    lines=[line.split(':') for line in read(url+'.idx').decode().splitlines()]
    fields=[]
    for element in ['UGRD','VGRD']:
        i=next(i for i,line in enumerate(lines) if line[3]==element and line[4]=='10 m above ground')
        start=int(lines[i][1]);end=int(lines[i+1][1])-1
        fields.append(read(url,{'Range':f'bytes={start}-{end}'}))
    with tempfile.TemporaryDirectory() as folder:
        path=Path(folder)/'wind.grib2';path.write_bytes(b''.join(fields));ds=gdal.Open(str(path))
        gt=ds.GetGeoTransform()
        if gt[1]!=.25 or gt[5]!=-.25 or ds.RasterXSize!=1440:raise ValueError(f'Unexpected grid {gt}')
        values=[]
        for i,name in [(1,'UGRD'),(2,'VGRD')]:
            band=ds.GetRasterBand(i)
            if band.GetMetadataItem('GRIB_ELEMENT')!=name:raise ValueError('Wrong wind component')
            data=band.ReadAsArray()[::2,::2]
            good=np.isfinite(data)&(np.abs(data)<200)
            values.append(np.where(good,np.rint(data*10),32767).astype('<i2'))
        ny,nx=values[0].shape
        # Pixel centres describe geographic sample locations; row order remains north to south.
        info={'time':int(valid.timestamp()*1000),'run':int(run.timestamp()*1000),'nx':nx,'ny':ny,'lon0':gt[0]+gt[1]/2,'lat0':gt[3]+gt[5]/2,'dx':.5,'dy':-.5,'url':'/wind/'+ident+'.bin','units':'m/s','scale':.1,'missing':32767}
        packed=np.stack(values,axis=-1).tobytes()
        temp=ROOT/(ident+'.tmp');temp.write_bytes(gzip.compress(packed,compresslevel=6));os.replace(temp,ROOT/(ident+'.bin.gz'))
        meta.write_text(json.dumps(info));ds=None
        print('GFS wind',ident,nx,ny,info['lon0'],info['lat0'],flush=True)

def publish(error=None):
    latest={}
    for path in ROOT.glob('*.json'):
        f=json.loads(path.read_text())
        if f['time']<time.time()*1000-18*3600000:
            path.unlink(missing_ok=True);path.with_suffix('.bin.gz').unlink(missing_ok=True);continue
        if f['time'] not in latest or latest[f['time']]['run']<f['run']:latest[f['time']]=f
    with lock:state.update(frames=sorted(latest.values(),key=lambda f:f['time']),error=error)

def catalog():
    with lock:return {**state,'source':'NOAA GFS','heightMetres':10,'resolutionDegrees':.5}

def worker():
    publish()
    while True:
        errors=[]
        now=dt.datetime.now(dt.timezone.utc).replace(minute=0,second=0,microsecond=0)
        cycle=now.replace(hour=now.hour//6*6)
        for offset in [0,1,-1,-2,-3,-4,2,3]:
            valid=now+dt.timedelta(hours=offset)
            for back in [0,6,12]:
                run=cycle-dt.timedelta(hours=back)
                if run>valid:continue
                try:produce(run,valid);publish();break
                except Exception as e:
                    errors.append(str(e))
            else:print('GFS unavailable',valid.isoformat(),errors[-1:],flush=True)
        publish('Some wind hours unavailable' if not state['frames'] else None)
        time.sleep(600)

def start():threading.Thread(target=worker,daemon=True).start()
