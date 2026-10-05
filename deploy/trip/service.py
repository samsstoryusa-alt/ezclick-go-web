"""Bounded public gateway: private Valhalla + cached NOAA/NWS hourly forecasts."""
import json, math, time, threading, os, re, urllib.request, urllib.error
from collections import OrderedDict, deque
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timezone
CACHE=OrderedDict(); LOCK=threading.Lock(); LIMITS={}; SLOTS=threading.BoundedSemaphore(4)
POOL=ThreadPoolExecutor(max_workers=4)
UA='EZCLICK GO route weather (https://weather.ezclickgo.com)'
def finite(v):return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
def coords(p):return isinstance(p,dict) and finite(p.get('lon')) and finite(p.get('lat')) and -125<=p['lon']<=-66 and 24<=p['lat']<=50

def read(url,ttl=0,payload=None):
    now=time.time()
    with LOCK:
        old=CACHE.get(url)
        if ttl and old and now-old[0]<ttl:return old[1]
    req=urllib.request.Request(url,data=json.dumps(payload).encode() if payload is not None else None,headers={'User-Agent':UA,'Accept':'application/geo+json, application/json','Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=35 if payload is not None else 12) as r:data=json.load(r)
    if ttl:
        with LOCK:
            CACHE[url]=(now,data);CACHE.move_to_end(url)
            while len(CACHE)>1000:CACHE.popitem(last=False)
    return data

def add_timing(result):
    # Preserve step-specific travel times instead of assuming one speed for the trip.
    for r in result.get('routes',[]):
        points=[];elapsed=[];clock=0.0
        for leg in r.get('legs',[]):
            for step in leg.get('steps',[]):
                shape=step.get('geometry',{}).get('coordinates',[]);duration=step.get('duration',0)
                if not shape or not finite(duration):continue
                distances=[0.0]
                for a,b in zip(shape,shape[1:]):
                    lat1,lat2=math.radians(a[1]),math.radians(b[1]);h=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(math.radians(b[0]-a[0])/2)**2
                    distances.append(distances[-1]+2*6371000*math.asin(math.sqrt(min(1,h))))
                for i,p in enumerate(shape):
                    t=clock+(duration*distances[i]/distances[-1] if distances[-1] else 0)
                    if points and p==points[-1]:elapsed[-1]=max(elapsed[-1],t)
                    else:points.append(p);elapsed.append(t)
                clock+=duration
        if len(points)>1 and abs(clock-r.get('duration',0))<2:
            r['geometry']={'type':'LineString','coordinates':points};elapsed[-1]=r['duration'];r['elapsedSeconds']=elapsed
    return result

def coverage():return os.getenv('ROUTING_COVERAGE','contiguous-us')

def route(body):
    loc=body.get('locations');t=body.get('truck',{})
    if not isinstance(loc,list) or len(loc)!=2 or not all(coords(x) for x in loc):raise ValueError('Choose two points in the contiguous United States.')
    if coverage()=='colorado' and any(not (-109.06<=x['lon']<=-102.04 and 36.99<=x['lat']<=41.01) for x in loc):raise ValueError('Colorado preview is available while US routes are being prepared.')
    bounds={'height':(1,10),'width':(1,10),'length':(2,50),'weight':(.1,150),'axle_load':(.1,40),'axle_count':(2,20)}
    if not isinstance(t,dict) or any(not finite(t.get(k)) or not lo<=t[k]<=hi for k,(lo,hi) in bounds.items()) or t['axle_count']%1 or t['axle_load']>t['weight'] or not isinstance(t.get('hazmat'),bool):raise ValueError('Check truck dimensions and loaded weight.')
    truck={k:t[k] for k in bounds};truck.update(hazmat=t['hazmat'],hgv_no_access_penalty=43200,use_truck_route=.5,use_highways=1,exclude_unpaved=True)
    payload={'locations':[dict(lon=x['lon'],lat=x['lat'],type='break',search_cutoff=2000) for x in loc],'costing':'truck','costing_options':{'truck':truck},'format':'osrm','shape_format':'geojson','units':'kilometers'}
    result=add_timing(read(os.getenv('VALHALLA_URL','http://127.0.0.1:8003')+'/route',payload=payload))
    if result.get('code')!='Ok':return result
    # The map needs geometry and timing, not duplicated turn-by-turn step geometry.
    keys=('distance','duration','geometry','elapsedSeconds')
    return {'code':'Ok','routes':[{k:r[k] for k in keys if k in r} for r in result.get('routes',[])[:1]]}

def forecast_timestamp(value):
    # NWS times must name their UTC offset; never infer the server's timezone.
    parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
    if parsed.tzinfo is None or parsed.utcoffset() is None:raise ValueError('Forecast timestamp needs a timezone.')
    return parsed.timestamp()

def forecast(p):
    out={**p,'available':False,'condition':'Forecast unavailable','level':'unknown'}
    try:
        meta=read(f"https://api.weather.gov/points/{p['lat']:.3f},{p['lon']:.3f}",86400)['properties']
        url=meta.get('forecastHourly','')
        if not re.fullmatch(r'https://api.weather.gov/gridpoints/[A-Z]{3}/[0-9]+,[0-9]+/forecast/hourly',url):return out
        data=read(url,600)['properties']
        updated=data.get('updateTime') or data.get('generatedAt')
        if not updated:return out
        age=time.time()-forecast_timestamp(updated)
        # Allow minor clock skew, but do not accept a future-issued forecast.
        if age>24*3600 or age < -300:return out
        period=next((x for x in data.get('periods',[]) if forecast_timestamp(x['startTime'])<=p['eta']/1000<forecast_timestamp(x['endTime'])),None)
        if not period:return out
        temp=period.get('temperature');unit=period.get('temperatureUnit')
        winds=[float(x) for x in re.findall(r'[0-9]+(?:\.[0-9]+)?',period.get('windSpeed',''))]
        speed=max(winds) if winds and 'mph' in period.get('windSpeed','') else None
        pop=(period.get('probabilityOfPrecipitation') or {}).get('value')
        text=period.get('shortForecast')
        if not isinstance(text,str) or not text.strip():return out
        lower=text.lower()
        if not finite(temp) or unit not in ('F','C') or speed is None:return out
        if not finite(pop) or not 0<=pop<=100:pop=None
        severe=any(x in lower for x in ('thunder','freezing','ice','blizzard','hail')) or speed>=35
        caution=any(x in lower for x in ('rain','snow','sleet','fog','drizzle','wintry')) or speed>=20 or (pop is not None and pop>=50)
        town=meta.get('relativeLocation',{}).get('properties',{})
        out.update(available=True,condition=text,level='high' if severe else 'caution' if caution else 'low',temperatureC=(temp-32)*5/9 if unit=='F' else temp,windMph=speed,windDirection=period.get('windDirection',''),precipProbability=pop,place=', '.join(filter(None,[town.get('city'),town.get('state')])),updatedAt=updated)
    except Exception:pass
    return out

def weather(body):
    points=body.get('points');now=time.time()*1000
    if not isinstance(points,list) or not 2<=len(points)<=24:raise ValueError('Expected 2 to 24 route samples.')
    for p in points:
        if not coords(p) or not finite(p.get('eta')) or not now-3600000<=p['eta']<=now+14*86400000 or not finite(p.get('fraction')) or not 0<=p['fraction']<=1:raise ValueError('Choose a valid departure and trip duration.')
    return {'points':list(POOL.map(forecast,points)),'source':'NOAA / National Weather Service','checkedAt':int(time.time()*1000)}

class Handler(BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def setup(self):
        super().setup();self.connection.settimeout(20)
    def log_message(self,*args):pass # Do not log users' coordinates.
    def response_headers(self):
        origin=self.headers.get('Origin','')
        if origin in ('http://127.0.0.1:5174','http://localhost:5174'):
            self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin')
        self.send_header('Access-Control-Allow-Headers','Content-Type');self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
        self.send_header('Cache-Control','no-store');self.send_header('Content-Type','application/json')
    def reply(self,status,value):
        raw=json.dumps(value,allow_nan=False).encode();print(f"{self.command} {self.path.split('?')[0]} {status}",flush=True);self.send_response(status);self.response_headers();self.send_header('Content-Length',str(len(raw)));self.end_headers()
        try:self.wfile.write(raw)
        except (BrokenPipeError,ConnectionResetError):pass
    def do_OPTIONS(self):self.reply(200,{})
    def do_GET(self):self.reply(200,{'ok':True,'coverage':coverage()}) if self.path=='/health' else self.reply(404,{'error':'Not found'})
    def do_POST(self):
        if self.path not in ('/route','/weather'):self.reply(404,{'error':'Not found'});return
        try:size=int(self.headers.get('Content-Length','0'))
        except ValueError:size=0
        if not 0<size<=16000:self.reply(413,{'error':'Request too large'});return
        ip=self.headers.get('CF-Connecting-IP') or self.headers.get('X-Forwarded-For',self.client_address[0]).split(',')[0];now=time.time()
        with LOCK:
            if len(LIMITS)>10000:
                for k in list(LIMITS):
                    if not LIMITS[k] or LIMITS[k][-1]<now-60:del LIMITS[k]
            q=LIMITS.setdefault(ip,deque())
            while q and q[0]<now-60:q.popleft()
            allowed=len(q)<20
            if allowed:q.append(now)
        if not allowed:self.reply(429,{'error':'Please wait a minute before trying again.'});return
        if not SLOTS.acquire(False):self.reply(503,{'error':'Route service is busy. Please try again.'});return
        try:
            body=json.loads(self.rfile.read(size))
            if not isinstance(body,dict):raise ValueError('Invalid request')
            self.reply(200,route(body) if self.path=='/route' else weather(body))
        except ValueError as e:self.reply(400,{'error':str(e)})
        except urllib.error.HTTPError as e:
            self.reply(422 if e.code==400 else 503,{'error':'No truck route found. Move points nearer accessible roads.' if e.code==400 else 'Routing is temporarily unavailable.'})
        except Exception:self.reply(503,{'error':'Service temporarily unavailable. Try again.'})
        finally:SLOTS.release()
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',8767),Handler).serve_forever()
