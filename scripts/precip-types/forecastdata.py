"""Hourly instantaneous GFS precipitation forecast, same run as its wind fields."""
import datetime as dt
from concurrent.futures import ThreadPoolExecutor
import json
import math
import os
from pathlib import Path
import tempfile
import threading
import time
import numpy as np
from osgeo import gdal
from PIL import Image, ImageFilter
import winddata

ROOT=Path('/data/forecast');ROOT.mkdir(exist_ok=True)
MANIFEST=ROOT/'catalog.json'
BBOX=(-130,22,-60,52)

def produce(run,valid):
    ident=f'{int(run.timestamp()*1000)}_{int(valid.timestamp()*1000)}'
    path=ROOT/(ident+'.png')
    if path.exists():return {'time':int(valid.timestamp()*1000),'run':int(run.timestamp()*1000),'url':'/forecast/'+path.name}
    lead=int((valid-run).total_seconds()/3600)
    url=winddata.BASE+run.strftime('gfs.%Y%m%d/%H/atmos/gfs.t%Hz.pgrb2.0p25.')+f'f{lead:03}'
    lines=[line.split(':') for line in winddata.read(url+'.idx').decode().splitlines()]
    arrays=[]
    with tempfile.TemporaryDirectory() as folder:
        for element in ['PRATE','CRAIN','CSNOW']:
            # Instantaneous fields only: never confuse interval averages with valid-time values.
            i=next(i for i,row in enumerate(lines) if row[3]==element and row[4]=='surface' and row[5]==f'{lead} hour fcst')
            start=int(lines[i][1]);end=int(lines[i+1][1])-1
            raw=Path(folder)/(element+'.grib2')
            raw.write_bytes(winddata.read(url,{'Range':f'bytes={start}-{end}'}))
            source=gdal.Open(str(raw))
            if source.GetRasterBand(1).GetMetadataItem('GRIB_ELEMENT')!=element:raise ValueError('Wrong precipitation field')
            y=lambda lat:6378137*math.log(math.tan(math.pi/4+math.radians(lat)/2))
            bounds=[6378137*math.radians(-130),y(22),6378137*math.radians(-60),y(52)]
            ds=gdal.Warp('',source,format='MEM',dstSRS='EPSG:3857',outputBounds=bounds,width=1024,height=600,resampleAlg='bilinear' if element=='PRATE' else 'near',dstNodata=-9999)
            arrays.append(ds.GetRasterBand(1).ReadAsArray());ds=None;source=None
    rate,rain,snow=arrays
    rate=rate*3600 # kg/m²/s -> mm/hour liquid equivalent (also for snow)
    good=np.isfinite(rate)&(rate>=0)&(rate<500)&((rain>.5)|(snow>.5))
    levels=np.array([0,.2,1,3,8,20,50])
    colors=np.array([[45,139,169],[43,166,178],[55,190,148],[92,201,106],[219,193,75],[226,131,67],[204,81,92]])
    rgba=np.zeros((*rate.shape,4),dtype=np.uint8)
    safe=np.where(good,rate,0)
    for c in range(3):rgba[:,:,c]=np.interp(safe,levels,colors[:,c]).astype(np.uint8)
    rgba[snow>.5,:3]=[192,165,247]
    rgba[:,:,3]=np.where(good,np.clip(np.log1p(safe*4)*80,0,220),0).astype(np.uint8)
    # Small blur is purely visual; geographical field and timestamps stay fixed.
    Image.fromarray(rgba).filter(ImageFilter.GaussianBlur(.7)).save(str(path)+'.tmp',format='PNG')
    os.replace(str(path)+'.tmp',path)
    return {'time':int(valid.timestamp()*1000),'run':int(run.timestamp()*1000),'url':'/forecast/'+path.name}

def catalog():
    try:return json.loads(MANIFEST.read_text())
    except (OSError,ValueError):return {'frames':[],'error':'Forecast is initializing'}

def update():
    now=dt.datetime.now(dt.timezone.utc).replace(minute=0,second=0,microsecond=0)
    cycle=now.replace(hour=now.hour//6*6)
    errors=[]
    for back in [0,6,12]:
        run=cycle-dt.timedelta(hours=back)
        if run>=now:continue
        try:
            # Probe the far end first; publish only a complete, consistent model run.
            end=now+dt.timedelta(hours=25)
            produce(run,end)
            def hour(offset):
                valid=now+dt.timedelta(hours=offset)
                frame=produce(run,valid)
                winddata.produce(run,valid)
                return frame
            with ThreadPoolExecutor(max_workers=3) as pool:
                frames=list(pool.map(hour,range(26)))
            winddata.publish()
            body={'frames':frames,'run':int(run.timestamp()*1000),'updatedAt':int(time.time()*1000),'source':'NOAA GFS','bbox':BBOX,'width':1024,'height':600,'units':'mm/hour liquid equivalent'}
            temp=ROOT/'catalog.tmp';temp.write_text(json.dumps(body));os.replace(temp,MANIFEST)
            print('Forecast ready',run.isoformat(),len(frames),flush=True)
            for path in ROOT.glob('*.png'):
                if int(path.stem.split('_')[0])<time.time()*1000-24*3600000:path.unlink(missing_ok=True)
            return
        except Exception as error:
            errors.append(str(error));print('Forecast run pending',run.isoformat(),str(error),flush=True)
    raise RuntimeError('; '.join(errors))

def worker():
    while True:
        try:update()
        except Exception as error:print('Forecast update failed',str(error),flush=True)
        time.sleep(600)

def start():threading.Thread(target=worker,daemon=True).start()


