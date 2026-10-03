import numpy as np
from forecastdata import render_precip
rate=np.ones((40,40),dtype=float)*3
rain=np.ones_like(rate);snow=np.zeros_like(rate)
full=np.asarray(render_precip(rate,rain,snow))
partial=np.asarray(render_precip(rate,rain*.25,snow))
assert 0<partial[20,20,3]<full[20,20,3], 'partial coverage must not be binary'
assert np.asarray(render_precip(rate,rain*0,snow)).max()==0, 'no coverage is transparent'
assert np.asarray(render_precip(rate*0,rain,snow))[:,:,3].max()==0, 'dry field stays transparent'
snow_image=np.asarray(render_precip(rate,rain*0,snow+1))
assert snow_image[20,20,2]>snow_image[20,20,0], 'snow keeps violet palette'
rain[:,20:]=0
edge=np.asarray(render_precip(rate,rain,snow))
assert len(np.unique(edge[20,14:26,3]))>5, 'edge must fade smoothly'
assert edge[20,22,0]>20, 'no dark fringe from transparent pixels'
print('Precipitation rendering: fractional coverage, smooth alpha, dry areas and snow passed')

