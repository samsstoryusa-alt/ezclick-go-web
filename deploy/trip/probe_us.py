"""Read-only checks before switching the US routing service into production."""
import os, json
os.environ["VALHALLA_URL"]="http://127.0.0.1:8003"
import service
truck=dict(height=4.1148,width=2.5908,length=21.9456,weight=36.2873896,axle_load=9.0718474,axle_count=5,hazmat=False)
trips=[("Denver-Charlotte",(-104.9903,39.7392),(-80.8431,35.2271)),("Los Angeles-Seattle",(-118.2437,34.0522),(-122.3321,47.6062))]
for name,a,b in trips:
    result=service.route(dict(locations=[dict(lon=p[0],lat=p[1]) for p in (a,b)],truck=truck))
    assert result.get("code")=="Ok", result
    route=result["routes"][0]
    assert 1000000<route["distance"]<5000000, route["distance"]
    assert 0<route["duration"]<7*86400
    shape=route["geometry"]["coordinates"]
    timing=route.get("elapsedSeconds")
    assert timing and len(timing)==len(shape)
    assert all(a<=b for a,b in zip(timing,timing[1:]))
    assert abs(timing[-1]-route["duration"])<1
    print(json.dumps(dict(trip=name,miles=round(route["distance"]/1609.344),drivingHours=round(route["duration"]/3600,1),coordinates=len(shape))),flush=True)
    if name=="Denver-Charlotte":
        with open("/tmp/ezclick-denver-charlotte-route.json","w") as f:json.dump(route,f)
