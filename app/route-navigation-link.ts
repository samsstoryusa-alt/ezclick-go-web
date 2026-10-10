import type {RoutePoint} from './road-route';
// MapLibre points use longitude, latitude; geo URIs use latitude, longitude.
// A generic destination does not transfer our route geometry or truck settings.
function destinationCoordinates(point:RoutePoint|null):string|null{
 if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)return null;
 return `${point[1].toFixed(6)},${point[0].toFixed(6)}`;
}
export function destinationGeoUrl(point:RoutePoint|null):string|null{
 const coordinates=destinationCoordinates(point);
 return coordinates===null?null:`geo:0,0?q=${coordinates}`;
}
type NavigationBrowser={userAgent?:string;platform?:string;maxTouchPoints?:number};
export type DestinationNavigationOption={id:'trucker-path'|'apple-maps'|'google-maps';label:string;url:string;target?:'_blank'};
export function destinationNavigationOptions(point:RoutePoint|null,browser:NavigationBrowser={}):DestinationNavigationOption[]{
 const coordinates=destinationCoordinates(point);
 if(coordinates===null)return [];
 const ua=browser.userAgent??'';
 const android=/Android/i.test(ua);
 const mobile=android||/iPhone|iPad|iPod/i.test(`${ua} ${browser.platform??''}`)||(browser.platform==='MacIntel'&&(browser.maxTouchPoints??0)>1);
 const encoded=encodeURIComponent(coordinates);
 // The app is always chosen by the user. Detection only controls the provider's
 // documented parameter spelling and whether a web fallback uses another tab.
 // https://fleetnavigation.truckerpath.com/hc/en-us/articles/36436724452877
 const target=mobile?undefined:'_blank';
 return [
  {id:'trucker-path',label:'Trucker Path',url:`truckerpath://cal_route?${android?'d_addr':'daddr'}=${coordinates}`},
  {id:'apple-maps',label:'Apple Maps',url:`https://maps.apple.com/?daddr=${encoded}&dirflg=d`,target},
  {id:'google-maps',label:'Google Maps',url:`https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`,target},
 ];
}
