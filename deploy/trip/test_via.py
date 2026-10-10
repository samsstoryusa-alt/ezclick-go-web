import unittest,copy
from unittest.mock import patch
import service
class ViaChecks(unittest.TestCase):
 def test_all_points_reach_router_in_order_for_both_vehicle_profiles(self):
  points=[{'lon':-86.7816,'lat':36.1627},{'lon':-81.035,'lat':34.0007},{'lon':-81.6557,'lat':30.3322}]
  truck=dict(height=4.1,width=2.59,length=21.94,weight=36,axle_load=9,axle_count=5,hazmat=False)
  for vehicle in ('car','truck'):
   with patch.object(service,'read',return_value={'code':'Ok','routes':[]}) as request:
    service.route(dict(locations=points,vehicle=vehicle,truck=truck))
    payload=request.call_args.kwargs['payload']
    self.assertEqual([(p['lon'],p['lat']) for p in payload['locations']],[(p['lon'],p['lat']) for p in points])
    self.assertEqual(payload['costing'],'auto' if vehicle=='car' else 'truck')
    if vehicle=='truck':
     for k,v in truck.items():self.assertEqual(payload['costing_options']['truck'][k],v)
 def test_limits_and_coordinates_fail_before_network(self):
  with patch.object(service,'read') as request:
   for points in ([],[{'lon':-81,'lat':34}], [{'lon':-81,'lat':34}]*8,[{'lon':-81,'lat':34},{'lon':None,'lat':35},{'lon':-80,'lat':30}]):
    with self.assertRaises(ValueError):service.route(dict(locations=points,vehicle='car'))
   self.assertEqual(request.call_count,0)
 def test_all_leg_times_remain_continuous_at_waypoint(self):
  a,b,c=[-86,36],[-81,34],[-81,30]
  result={'routes':[dict(duration=500,legs=[dict(steps=[dict(duration=200,geometry=dict(coordinates=[a,b]))]),dict(steps=[dict(duration=300,geometry=dict(coordinates=[b,c]))])])]}
  route=service.add_timing(result)['routes'][0]
  self.assertEqual(route['geometry']['coordinates'],[a,b,c])
  self.assertEqual(route['elapsedSeconds'],[0,200,500])
if __name__=='__main__':unittest.main()
