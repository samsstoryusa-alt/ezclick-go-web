import unittest,time,copy
from datetime import timedelta
from unittest.mock import patch
import service
class Checks(unittest.TestCase):
 def test_coordinates(self):
  self.assertFalse(service.coords({'lon':float('nan'),'lat':40}))
  self.assertFalse(service.coords({'lon':-150,'lat':61}))
  self.assertTrue(service.coords({'lon':-105,'lat':40}))
 def test_truck_validation(self):
  with self.assertRaises(ValueError):service.route({'locations':[{'lon':-105,'lat':40}]*2,'truck':{}})
 def test_car_profile(self):
  with patch.object(service,'read',return_value={'code':'Ok','routes':[]}) as request:
   service.route({'locations':[{'lon':-86.78,'lat':36.16},{'lon':-81.65,'lat':30.33}],'vehicle':'car'})
   payload=request.call_args.kwargs['payload']
   self.assertEqual(payload['costing'],'auto');self.assertNotIn('truck',payload['costing_options'])
 def test_invalid_vehicle(self):
  with self.assertRaises(ValueError):service.route({'vehicle':'plane'})
 def test_fixed_truck_profile(self):
  truck=dict(height=4.1148,width=2.5908,length=21.9456,weight=36.2873896,axle_load=9.0718474,axle_count=5,hazmat=False)
  with patch.object(service,'read',return_value={'code':'Ok','routes':[]}) as request:
   service.route({'locations':[{'lon':-86.78,'lat':36.16},{'lon':-81.65,'lat':30.33}],'vehicle':'truck','truck':truck})
   payload=request.call_args.kwargs['payload'];self.assertEqual(payload['costing'],'truck')
   for key,value in truck.items():self.assertEqual(payload['costing_options']['truck'][key],value)
 def test_expired_request(self):
  with self.assertRaises(ValueError):service.weather({'points':[{'lon':-105,'lat':40,'fraction':0,'eta':0}]*2})
 def route_result(self,distance=1477000,duration=58000):
  return {'code':'Ok','routes':[{'distance':distance,'duration':duration,'geometry':{'type':'LineString','coordinates':[[-81.65,30.33],[-95.37,29.76]]}}]}
 def test_truck_detour_comparison_preserves_restrictions(self):
  truck=dict(height=4.5,width=2.59,length=21.94,weight=45,axle_load=10,axle_count=5,hazmat=True)
  with patch.object(service,'read',side_effect=[self.route_result(),self.route_result(1419000,56000)]) as request:
   result=service.route({'locations':[{'lon':-81.65,'lat':30.33},{'lon':-95.37,'lat':29.76}],'vehicle':'truck','truck':truck})
   self.assertEqual(result['routes'][0]['distance'],1419000)
   self.assertEqual(request.call_count,2)
   first,second=[c.kwargs['payload'] for c in request.call_args_list]
   expected=copy.deepcopy(first);expected['costing_options']['truck']['use_truck_route']=0
   self.assertEqual(second,expected)
   for key,value in truck.items():self.assertEqual(second['costing_options']['truck'][key],value)
   self.assertEqual(second['costing_options']['truck']['hgv_no_access_penalty'],43200)
   self.assertTrue(second['costing_options']['truck']['exclude_unpaved'])
   self.assertEqual(request.call_args_list[1].kwargs['timeout'],5)
 def test_truck_comparison_keeps_primary_on_failure(self):
  truck=dict(height=4.1,width=2.59,length=21.94,weight=36,axle_load=9,axle_count=5,hazmat=False)
  for alternative in [TimeoutError('timeout'),{'code':'NoRoute','routes':[]}]:
   with patch.object(service,'read',side_effect=[self.route_result(),alternative]):
    result=service.route({'locations':[{'lon':-81.65,'lat':30.33},{'lon':-95.37,'lat':29.76}],'truck':truck})
    self.assertEqual(result['routes'][0]['distance'],1477000)
 def test_detour_selection_thresholds(self):
  p=self.route_result(100000,1000)
  for distance,duration,expected in [(94000,999,True),(95000,1000,True),(96000,990,False),(94000,1001,False),(110000,900,False),(0,900,False)]:
   with self.subTest(distance=distance,duration=duration):
    self.assertEqual(service.preferable_truck_alternative(p,self.route_result(distance,duration)),expected)
  self.assertFalse(service.preferable_truck_alternative(self.route_result(),{'code':'Ok','routes':[]}))
  self.assertFalse(service.preferable_truck_alternative(self.route_result(1000000),self.route_result(985000,50000)))
 def test_missing_forecast_is_unknown(self):
  with patch.object(service,'read',side_effect=Exception('offline')):
   p=service.forecast({'lon':-105,'lat':40,'fraction':0,'eta':time.time()*1000})
   self.assertFalse(p['available']);self.assertEqual(p['level'],'unknown')
 def test_severe_forecast_and_temperature(self):
  now=time.time();date=lambda t:service.datetime.fromtimestamp(t,service.timezone.utc).isoformat()
  meta={'properties':{'forecastHourly':'https://api.weather.gov/gridpoints/BOU/1,2/forecast/hourly','relativeLocation':{'properties':{'city':'Test','state':'CO'}}}}
  hourly={'properties':{'updateTime':date(now),'periods':[{'startTime':date(now-3600),'endTime':date(now+3600),'temperature':32,'temperatureUnit':'F','windSpeed':'25 to 40 mph','windDirection':'N','shortForecast':'Thunderstorms','probabilityOfPrecipitation':{'value':80}}]}}
  with patch.object(service,'read',side_effect=[meta,hourly]):
   p=service.forecast({'lon':-105,'lat':40,'fraction':0,'eta':now*1000});self.assertTrue(p['available']);self.assertEqual(p['level'],'high');self.assertEqual(p['temperatureC'],0);self.assertEqual(p['windMph'],40)
 def test_weather_concern_categories(self):
  now=time.time();date=lambda t:service.datetime.fromtimestamp(t,service.timezone.utc).isoformat()
  meta={'properties':{'forecastHourly':'https://api.weather.gov/gridpoints/BOU/1,2/forecast/hourly'}}
  for text,wind,expected in [('Thunderstorms',5,'high'),('Freezing Drizzle',5,'high'),('Drizzle',5,'caution'),('Sunny',40,'high'),('Sunny',5,'low'),('',5,'unknown')]:
   with self.subTest(condition=text,wind=wind):
    hourly={'properties':{'updateTime':date(now),'periods':[{'startTime':date(now-3600),'endTime':date(now+3600),'temperature':30,'temperatureUnit':'F','windSpeed':f'{wind} mph','shortForecast':text,'probabilityOfPrecipitation':{'value':20}}]}}
    with patch.object(service,'read',side_effect=[meta,hourly]):
     self.assertEqual(service.forecast({'lon':-105,'lat':40,'eta':now*1000})['level'],expected)
 def test_step_timing(self):
  result={'routes':[{'duration':300,'legs':[{'steps':[{'duration':100,'geometry':{'coordinates':[[-105,40],[-104,40]]}},{'duration':200,'geometry':{'coordinates':[[-104,40],[-103,40]]}}]}]}]}
  r=service.add_timing(result)['routes'][0];self.assertEqual(len(r['elapsedSeconds']),3);self.assertAlmostEqual(r['elapsedSeconds'][1],100);self.assertEqual(r['elapsedSeconds'][-1],300);self.assertEqual(len(r['geometry']['coordinates']),3)
 def forecast_fixture(self):
  now=1791194400
  date=lambda t:service.datetime.fromtimestamp(t,service.timezone.utc).isoformat()
  meta={'properties':{'forecastHourly':'https://api.weather.gov/gridpoints/OHX/1,2/forecast/hourly'}}
  period={'startTime':date(now),'endTime':date(now+3600),'temperature':65,'temperatureUnit':'F','windSpeed':'5 mph','shortForecast':'Sunny','probabilityOfPrecipitation':{'value':0}}
  hourly={'properties':{'updateTime':date(now),'periods':[period]}}
  return now,date,meta,hourly
 def forecast_result(self,now,meta,hourly,eta=None):
  with patch.object(service.time,'time',return_value=now),patch.object(service,'read',side_effect=[meta,hourly]):
   return service.forecast({'lon':-86.78,'lat':36.16,'fraction':0,'eta':(now if eta is None else eta)*1000})
 def test_forecast_freshness_boundaries(self):
  now,date,meta,hourly=self.forecast_fixture()
  for age,available in [(24*3600,True),(24*3600+1,False),(-300,True),(-301,False)]:
   with self.subTest(age=age):
    hourly['properties']['updateTime']=date(now-age)
    result=self.forecast_result(now,meta,hourly)
    self.assertEqual(result['available'],available)
    self.assertEqual(result['level'],'low' if available else 'unknown')
 def test_invalid_source_timestamps_are_unknown(self):
  now,date,meta,hourly=self.forecast_fixture()
  for timestamp in [None,'','not-a-date',date(now)[:19]]:
   with self.subTest(timestamp=timestamp):
    hourly['properties']['updateTime']=timestamp
    result=self.forecast_result(now,meta,hourly)
    self.assertFalse(result['available']);self.assertEqual(result['level'],'unknown')
  hourly['properties'].pop('updateTime')
  hourly['properties']['generatedAt']=date(now)
  self.assertTrue(self.forecast_result(now,meta,hourly)['available'])
 def test_period_boundaries_and_long_trip_coverage(self):
  now,date,meta,hourly=self.forecast_fixture()
  for eta,available in [(now-1,False),(now,True),(now+3599,True),(now+3600,False),(now+10*86400,False)]:
   with self.subTest(eta=eta):
    result=self.forecast_result(now,meta,hourly,eta)
    self.assertEqual(result['available'],available)
    self.assertEqual(result['level'],'low' if available else 'unknown')
  # Offset changes do not move the forecast's absolute coverage window.
  offset=service.timezone(timedelta(hours=-5))
  hourly['properties']['periods'][0].update(startTime=service.datetime.fromtimestamp(now,offset).isoformat(),endTime=service.datetime.fromtimestamp(now+3600,offset).isoformat())
  self.assertTrue(self.forecast_result(now,meta,hourly)['available'])
 def test_naive_period_timestamps_are_unknown(self):
  now,date,meta,hourly=self.forecast_fixture()
  for field in ['startTime','endTime']:
   with self.subTest(field=field):
    malformed=copy.deepcopy(hourly)
    malformed['properties']['periods'][0][field]=date(now)[:19]
    result=self.forecast_result(now,meta,malformed)
    self.assertFalse(result['available']);self.assertEqual(result['level'],'unknown')
 def test_missing_required_measurements_are_unknown(self):
  now,date,meta,hourly=self.forecast_fixture()
  for field,value in [('temperature',None),('temperature',float('nan')),('temperatureUnit','K'),('windSpeed',''),('shortForecast',None)]:
   with self.subTest(field=field,value=value):
    incomplete=copy.deepcopy(hourly)
    incomplete['properties']['periods'][0][field]=value
    result=self.forecast_result(now,meta,incomplete)
    self.assertFalse(result['available']);self.assertEqual(result['level'],'unknown')
 def test_long_trip_preserves_covered_samples(self):
  now,date,meta,hourly=self.forecast_fixture()
  points=[{'lon':-86.78,'lat':36.16,'fraction':i,'eta':(now+i*10*86400)*1000} for i in [0,1]]
  with patch.object(service.time,'time',return_value=now),patch.object(service,'read',side_effect=lambda url,ttl:meta if '/points/' in url else hourly):
   result=service.weather({'points':points})
  self.assertEqual([p['level'] for p in result['points']],['low','unknown'])
  self.assertEqual([p['available'] for p in result['points']],[True,False])
 def test_untrusted_url_rejected(self):
  with patch.object(service,'read',return_value={'properties':{'forecastHourly':'http://localhost/secrets'}}) as read:
   self.assertFalse(service.forecast({'lon':-105,'lat':40,'eta':time.time()*1000})['available']);self.assertEqual(read.call_count,1)
if __name__=='__main__':unittest.main()
