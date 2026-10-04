"""Check arrival-time forecasts on the verified Denver-Charlotte route."""
import json, math, time
import service
r=json.load(open('/tmp/ezclick-denver-charlotte-route.json'))
c=r['geometry']['coordinates']; elapsed=r['elapsedSeconds']; distance=[0.0]
for a,b in zip(c,c[1:]):
    x,y=math.radians(a[1]),math.radians(b[1])
    h=math.sin((y-x)/2)**2+math.cos(x)*math.cos(y)*math.sin(math.radians(b[0]-a[0])/2)**2
    distance.append(distance[-1]+12742000*math.asin(math.sqrt(min(1,h))))
points=[]; j=1; now=time.time()*1000
for i in range(16):
    f=i/15; target=distance[-1]*f
    while j<len(c)-1 and distance[j]<target:j+=1
    w=(target-distance[j-1])/(distance[j]-distance[j-1] or 1)
    points.append(dict(lon=c[j-1][0]+(c[j][0]-c[j-1][0])*w,lat=c[j-1][1]+(c[j][1]-c[j-1][1])*w,fraction=f,eta=now+1000*(elapsed[j-1]+(elapsed[j]-elapsed[j-1])*w)))
t0=time.monotonic(); result=service.weather({'points':points})
for p in result['points']:
    print(json.dumps({k:p.get(k) for k in ('fraction','place','available','condition','level','windMph','precipProbability')}),flush=True)
print(json.dumps(dict(available=sum(p['available'] for p in result['points']),total=len(points),seconds=round(time.monotonic()-t0,1))),flush=True)
assert len(result['points'])==16
assert any(p['available'] for p in result['points']), 'No current forecasts returned'
