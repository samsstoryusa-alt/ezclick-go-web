"use client";
import {useEffect,useState} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
type Place={city?:string;district?:string;locality?:string;name?:string;state?:string;country?:string;postcode?:string;countrycode?:string};
const cache=new Map<string,Place>();
let lastRequest=0;
export default function PointPlace({map,ready}:{map:LibreMap|null;ready:boolean}) {
  const [place,setPlace]=useState<Place|null>(null);
  const [status,setStatus]=useState('Finding place…');
  const [busy,setBusy]=useState(true);
  useEffect(()=>{
    if(!map||!ready)return;
    let timer=0,version=0,disposed=false;
    let controller:AbortController|undefined;
    const cancel=()=>{version++;clearTimeout(timer);controller?.abort();};
    const load=async()=>{
      const ticket=version;
      const canvas=map.getCanvas();const point=map.unproject([canvas.clientWidth/2,canvas.clientHeight/2]);
      const lat=point.lat.toFixed(5),lon=(((point.lng+180)%360+360)%360-180).toFixed(5);
      const key=lat+','+lon;
      const cached=cache.get(key);
      if(cached){setPlace(cached);setBusy(false);setStatus('');return;}
      lastRequest=Date.now();controller=new AbortController();const request=controller;
      const timeout=window.setTimeout(()=>request.abort(),10000);
      try{
        const query=new URLSearchParams({lat,lon,lang:'en',radius:'1'});
        const response=await fetch('https://photon.komoot.io/reverse?'+query,{signal:request.signal});
        if(!response.ok)throw new Error('Unavailable');
        const data=await response.json() as {features?:{properties:Place}[]};
        if(disposed||ticket!==version)return;
        const result=data.features?.[0]?.properties;
        setPlace(result??null);setStatus(result?'':'No nearby place');setBusy(false);
        if(result){if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,result);}
      }catch{if(!disposed&&ticket===version){setPlace(null);setBusy(false);setStatus('Place unavailable');}}
      finally{clearTimeout(timeout);}
    };
    const moving=()=>{cancel();setBusy(true);setStatus('Selecting place…');};
    const settled=()=>{clearTimeout(timer);timer=window.setTimeout(()=>void load(),Math.max(650,1500-(Date.now()-lastRequest)));};
    map.on('movestart',moving);map.on('moveend',settled);settled();
    return()=>{disposed=true;cancel();map.off('movestart',moving);map.off('moveend',settled);};
  },[map,ready]);
  const name=place?.city||place?.district||place?.locality||place?.name;
  return <div className={`point-place ${busy?'is-updating':''}`} aria-live="polite" aria-busy={busy}>
    <strong title="Nearest mapped place · OpenStreetMap">{busy?status:name||status||'Selected area'}</strong>
    <span>{!busy&&place?<>{[place.state,place.countrycode!=='US'?place.country:null].filter(Boolean).join(' · ')}<b title="Postal code of the nearest mapped place">{place.postcode?`${place.countrycode==='US'?'ZIP':'Postal'} ${place.postcode}`:'ZIP unavailable'}</b></>:<>&nbsp;</>}</span>

  </div>;
}
