import type {RoutePoint} from './road-route';
// MapLibre points use longitude, latitude; geo URIs use latitude, longitude.
// A generic destination does not transfer our route geometry or truck settings.
export function destinationGeoUrl(point:RoutePoint|null):string|null{
 if(!point||!point.every(Number.isFinite)||Math.abs(point[1])>90)return null;
 const lon=(((point[0]+180)%360)+360)%360-180;
 const coordinates=`${point[1].toFixed(6)},${lon.toFixed(6)}`;
 return `geo:0,0?q=${coordinates}`;
}
