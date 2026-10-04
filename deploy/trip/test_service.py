import unittest,time
from unittest.mock import patch
import service
class Checks(unittest.TestCase):
 def test_coordinates(self):
  self.assertFalse(service.coords({'lon':float('nan'),'lat':40}))
  self.assertFalse(service.coords({'lon':-150,'lat':61}))
  self.assertTrue(service.coords({'lon':-105,'lat':40}))
 def test_truck_validation(self):
  with self.assertRaises(ValueError):service.route({'locations':[{'lon':-105,'lat':40}]*2,'truck':{}})
 def test_expired_request(self):
  with self.assertRaises(ValueError):service.weather({'points':[{'lon':-105,'lat':40,'fraction':0,'eta':0}]*2})
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
 def test_untrusted_url_rejected(self):
  with patch.object(service,'read',return_value={'properties':{'forecastHourly':'http://localhost/secrets'}}) as read:
   self.assertFalse(service.forecast({'lon':-105,'lat':40,'eta':time.time()*1000})['available']);self.assertEqual(read.call_count,1)
if __name__=='__main__':unittest.main()
