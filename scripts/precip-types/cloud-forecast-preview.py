"""Build a bounded preview from the same GFS run and valid hours as precipitation."""
import sys
sys.path.insert(0,'/app')
import winddata
import datetime as dt
import json,math,os,tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from osgeo import gdal
from PIL import Image
root=Path('/data/cloud-preview');root.mkdir(exist_ok=True)
catalog=json.loads(Path('/data/forecast-v2/catalog.json').read_text())
def produce(frame):
 run=dt.datetime.fromtimestamp(frame['run']/1000,dt.timezone.utc)
 valid=dt.datetime.fromtimestamp(frame['time']/1000,dt.timezone.utc)
 lead=int((valid-run).total_seconds()/3600)
 name=f"{frame['run']}_{frame['time']}.png"
 path=root/name
 if not path.exists():
  url=winddata.BASE+run.strftime('gfs.%Y%m%d/%H/atmos/gfs.t%Hz.pgrb2.0p25.')+f'f{lead:03}'
  lines=[line.split(':') for line in winddata.read(url+'.idx').decode().splitlines()]
  i=next(i for i,row in enumerate(lines) if row[3]=='TCDC' and row[4]=='entire atmosphere' and row[5]==f'{lead} hour fcst')
  start=int(lines[i][1]);end=int(lines[i+1][1])-1
  with tempfile.TemporaryDirectory() as folder:
   raw=Path(folder)/'cloud.grib2';raw.write_bytes(winddata.read(url,{'Range':f'bytes={start}-{end}'}))
   src=gdal.Open(str(raw));band=src.GetRasterBand(1)
   if band.GetMetadataItem('GRIB_ELEMENT')!='TCDC':raise ValueError('Wrong cloud field')
   y=lambda lat:6378137*math.log(math.tan(math.pi/4+math.radians(lat)/2))
   ds=gdal.Warp('',src,format='MEM',dstSRS='EPSG:3857',outputBounds=[6378137*math.radians(-130),y(22),6378137*math.radians(-60),y(52)],width=1024,height=600,resampleAlg='bilinear',dstNodata=-9999)
   values=ds.GetRasterBand(1).ReadAsArray();valid=(values>=0)&(values<=100)&np.isfinite(values)
   rgba=np.zeros((*values.shape,4),dtype=np.uint8);rgba[:,:,:3]=[228,239,248]
   rgba[:,:,3]=np.rint(np.where(valid,np.clip(values,0,100)/100*230,0)).astype(np.uint8)
   Image.fromarray(rgba).save(str(path)+'.tmp',format='PNG');os.replace(str(path)+'.tmp',path)
 return {'time':frame['time'],'run':frame['run'],'url':'/cloud-preview/'+name}
with ThreadPoolExecutor(max_workers=3) as pool:frames=list(pool.map(produce,catalog['frames']))
(root/'catalog.json').write_text(json.dumps({'frames':frames,'run':catalog['run'],'source':'NOAA GFS TCDC','units':'percent cloud cover','kind':'forecast'}))
print(json.dumps({'frames':len(frames),'run':catalog['run']}),flush=True)
