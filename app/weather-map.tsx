"use client";

import VoiceRouteDrawer from './voice-route-drawer';
import WeatherVehicleMenu from './weather-vehicle';
import WeatherLanguageMenu from './weather-language-menu';
import WeatherQualityMenu from './weather-quality-menu';
import WeatherSupport from './weather-support';
import {getWeatherQuality,qualityProfiles,useWeatherQuality} from './weather-quality';
import {useWeatherLanguage} from './weather-language';
import {platformUrl} from './site-links';
import {platformBrandImage,type WeatherBrandImage} from './weather-brand';
import {standaloneWeather,readTrip} from './weather-trip-storage';

import {useEffect, useRef, useState, type PointerEvent, type KeyboardEvent} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './weather-map.css';
import {applyMapPalette} from './map-night-palette';
import WeatherLegend from './weather-legend';
import RadarControls from './radar-controls';
import SatellitePreview from './satellite-preview';
import SatelliteControl, {type SatelliteMode} from './satellite-control';
import SatelliteBasemap from './satellite-basemap';
import RoadControls from './road-controls';
import {WeatherRoute} from './weather-route';
import {WeatherCenterMarker} from './weather-center-marker';

import PointWeather from './point-weather';
import WindControls from './wind-controls';
import {useWindFields} from './wind-field';
import {useWeatherUnits} from './weather-units';
import {installSoftVegetation} from './soft-vegetation';

const demoRoute = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'nashville-jacksonville';
const INITIAL_VIEW = standaloneWeather() || demoRoute ? {center:[-86.7816,36.1627] as [number,number],zoom:8} : {center: [-105.6, 39.65] as [number, number], zoom: 8};
const TERRAIN_URL = 'https://tiles.mapterhorn.com/tilejson.json';


export default function WeatherMap({brandImage=platformBrandImage}:{brandImage?:WeatherBrandImage}={}) {
  const {language,dir,t}=useWeatherLanguage();
  const quality=useWeatherQuality();
  const embeddedTrip = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "trip";
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const scaleRef=useRef<{setUnit:(unit:'imperial'|'metric')=>void}|null>(null);
  const [satelliteMode,setSatelliteMode]=useState<SatelliteMode>('map');
  const satellite=satelliteMode!=='map';
  const [weatherTime,setWeatherTime]=useState<number|null>(null);
  const [mobileExpanded,setMobileExpanded]=useState(false);
  const [mobilePortrait,setMobilePortrait]=useState(()=>typeof window!=="undefined"&&matchMedia('(max-width:767px) and (orientation:portrait)').matches);
  useEffect(()=>{const query=matchMedia('(max-width:767px) and (orientation:portrait)');const update=()=>setMobilePortrait(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  const [smallViewport,setSmallViewport]=useState(()=>typeof window!=="undefined"&&matchMedia('(max-width:767px),(max-width:950px) and (max-height:500px)').matches);
  useEffect(()=>{const query=matchMedia('(max-width:767px),(max-width:950px) and (max-height:500px)');const update=()=>setSmallViewport(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  // Standalone weather shares the phone workflow; viewport size only controls placement.
  const mobilePresentation=standaloneWeather()||smallViewport;
  const widePresentation=standaloneWeather()&&!smallViewport;
  const [routeInfoOpen,setRouteInfoOpen]=useState(true);
  const [cameraExpanded,setCameraExpanded]=useState(false);
  const [legendOpen,setLegendOpen]=useState(false);
  const cameraControlsRef=useRef<HTMLDivElement>(null);
  const cameraToggleRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const controls=cameraControlsRef.current;
    if(!mobilePresentation||!cameraExpanded||legendOpen||!controls)return;
    let timer=0;
    const restart=()=>{
      window.clearTimeout(timer);
      timer=window.setTimeout(()=>{
        if(controls.querySelector('#weather-camera-tools')?.contains(document.activeElement))cameraToggleRef.current?.focus({preventScroll:true});
        setCameraExpanded(false);
      },10000);
    };
    controls.addEventListener('pointerdown',restart);
    controls.addEventListener('pointerup',restart);
    controls.addEventListener('keydown',restart);
    controls.addEventListener('focusin',restart);
    restart();
    return()=>{
      window.clearTimeout(timer);
      controls.removeEventListener('pointerdown',restart);
      controls.removeEventListener('pointerup',restart);
      controls.removeEventListener('keydown',restart);
      controls.removeEventListener('focusin',restart);
    };
  },[mobilePresentation,cameraExpanded,legendOpen]);
  const [siteMenuOpen,setSiteMenuOpen]=useState(false);
  const [supportOpen,setSupportOpen]=useState(false);
  const [voicePanelOpen,setVoicePanelOpen]=useState(false);
  const siteMenuRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!siteMenuOpen)return;
    const outside=(event:globalThis.PointerEvent)=>{if(event.target instanceof Node&&!siteMenuRef.current?.contains(event.target))setSiteMenuOpen(false);};
    const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'){setSiteMenuOpen(false);siteMenuRef.current?.querySelector('button')?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[siteMenuOpen]);
  const sheetRef=useRef<HTMLDivElement>(null);
  const sheetDrag=useRef<{y:number;height:number;delta:number}|null>(null);
  const sheetTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const skipSheetClick=useRef(false);
  useEffect(()=>()=>{if(sheetTimer.current)clearTimeout(sheetTimer.current);},[]);
  function settleSheet(expanded:boolean){
    const sheet=sheetRef.current;if(!sheet)return;
    if(sheetTimer.current)clearTimeout(sheetTimer.current);
    const start=sheet.getBoundingClientRect().height;
    setMobileExpanded(expanded);
    requestAnimationFrame(()=>{
      if(!sheet.isConnected)return;
      sheet.style.transition='none';sheet.style.height='';
      const end=sheet.getBoundingClientRect().height;
      sheet.style.height=start+'px';sheet.getBoundingClientRect();
      sheet.style.transition=window.matchMedia('(prefers-reduced-motion: reduce)').matches?'none':'height 460ms cubic-bezier(.22,1,.36,1)';
      sheet.style.height=end+'px';
      sheetTimer.current=setTimeout(()=>{sheet.style.height='';sheet.style.transition='';},480);
    });
  }
  function beginSheet(event:PointerEvent<HTMLButtonElement>){
    if(event.button!==0||!sheetRef.current)return;
    if(sheetTimer.current)clearTimeout(sheetTimer.current);
    skipSheetClick.current=false;
    sheetDrag.current={y:event.clientY,height:sheetRef.current.getBoundingClientRect().height,delta:0};
    sheetRef.current.style.transition='none';event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pullSheet(event:PointerEvent<HTMLButtonElement>){
    const drag=sheetDrag.current,sheet=sheetRef.current;if(!drag||!sheet)return;
    drag.delta=drag.y-event.clientY;
    const limit=(sheet.parentElement?.clientHeight??600)*.72;
    const desired=drag.height+drag.delta;
    const elastic=desired<130?130+(desired-130)*.18:desired>limit?limit+(desired-limit)*.18:desired;
    sheet.style.height=Math.max(90,elastic)+'px';
  }
  function releaseSheet(event:PointerEvent<HTMLButtonElement>){
    const drag=sheetDrag.current;if(!drag)return;sheetDrag.current=null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    skipSheetClick.current=Math.abs(drag.delta)>6;
    if(skipSheetClick.current)settleSheet(drag.delta>30?true:drag.delta< -30?false:mobileExpanded);
    else if(sheetRef.current)sheetRef.current.style.height='';
  }

  const [routeActive,setRouteActive]=useState(()=>demoRoute);
  const [routeCitiesOpen,setRouteCitiesOpen]=useState(false);
  const [resumeAvailable,setResumeAvailable]=useState(()=>{const saved=readTrip();return !!(saved?.points[0]&&saved.points[1]);});
  const [resumeRequest,setResumeRequest]=useState(0);
  const [ready, setReady] = useState(false);
  const [mapVisible,setMapVisible]=useState(false);
  const windData=useWindFields(ready);
  const {units,toggle:toggleUnits}=useWeatherUnits();
  useEffect(()=>{scaleRef.current?.setUnit(units==='us'?'imperial':'metric');},[units,ready]);
  const [radarMap, setRadarMap] = useState<LibreMap | null>(null);
  useEffect(()=>{if(ready)mapRef.current?.setPixelRatio(Math.min(window.devicePixelRatio||1,qualityProfiles[quality].pixelRatio));},[quality,ready]);
  useEffect(()=>{const receive=(event:Event)=>{const {action,reply,translate=t}=(event as CustomEvent).detail;if(['units_metric','units_us'].includes(action)){const wanted=action==='units_metric'?'metric':'us';if(units!==wanted)toggleUnits();reply(translate(wanted==='metric'?'Kilometers and Celsius enabled.':'Miles and Fahrenheit enabled.'));}};window.addEventListener('voice-map-action',receive);return()=>window.removeEventListener('voice-map-action',receive);},[units,toggleUnits,t]);
  const [terrainReady, setTerrainReady] = useState(false);
  const [threeD, setThreeD] = useState(false);
  const [error, setError] = useState('');
  const [terrainError, setTerrainError] = useState(false);
  const [locating,setLocating]=useState(false);
  const [locationMessage,setLocationMessage]=useState('');
  const [locationNoticeVisible,setLocationNoticeVisible]=useState(false);
  const [locationSucceeded,setLocationSucceeded]=useState(false);
  useEffect(()=>{
    if(!locationSucceeded||!locationNoticeVisible||locating)return;
    const timer=window.setTimeout(()=>setLocationNoticeVisible(false),2500);
    return()=>window.clearTimeout(timer);
  },[locationSucceeded,locationNoticeVisible,locating,locationMessage]);
  const [attempt, setAttempt] = useState(0);
  const globeDrag = useRef<{id: number; x: number; y: number; bearing: number; pitch: number} | null>(null);
  const globeFrame=useRef(0);
  const globeTarget=useRef<{bearing:number;pitch:number}|null>(null);
  useEffect(()=>()=>{cancelAnimationFrame(globeFrame.current);delete mapRef.current?.getContainer().dataset.globeRotating;},[]);
  const [camera, setCamera] = useState({bearing: 0, pitch: 0});

  useEffect(() => {
    let disposed = false;
    let map: LibreMap | undefined;
    let observer: ResizeObserver | undefined;
    let loaded = false;
    let disposeVegetation:(()=>void)|undefined;

    const timeout = window.setTimeout(() => {
      if (!disposed && !loaded) setError('The map is taking longer to load. Check your connection and try again.');
    }, 25000);
    async function initialize() {
      try {
        const lib = await import('maplibre-gl');
        lib.setWorkerUrl(workerUrl);
        if (disposed || !container.current) return;
        map = new lib.Map({
          container: container.current,
          style: 'https://tiles.openfreemap.org/styles/positron',
          ...(new URLSearchParams(window.location.search).get('motion')==='1'?{center:[-91,28] as [number,number],zoom:5}:INITIAL_VIEW),
          maxPitch: 65,
          pixelRatio: Math.min(window.devicePixelRatio || 1, qualityProfiles[getWeatherQuality()].pixelRatio),
          dragPan: true,
          scrollZoom: true,
          touchZoomRotate: true,
          attributionControl: false,
        });
        mapRef.current = map;
        // Apply the night palette before tiles become visible, not after the light map loads.
        map.on('style.load',()=>{if(!disposed&&map)applyMapPalette(map);});
        map.on('move', () => {if (!disposed && map) setCamera(previous=>{const bearing=map!.getBearing(),pitch=map!.getPitch();return Math.abs(previous.bearing-bearing)<.05&&Math.abs(previous.pitch-pitch)<.05?previous:{bearing,pitch};});});

        const scale=new lib.ScaleControl({unit:'imperial'});scaleRef.current=scale;
        map.addControl(scale,'bottom-left');
        map.addControl(new lib.AttributionControl({compact: false, customAttribution: '<a href="https://github.com/cwdaniel/RadrView" target="_blank" rel="noopener noreferrer">Wind animation: RadrView</a>'}), 'bottom-right');
        map.getCanvas().setAttribute('aria-label', 'Interactive EZCLICK map. Drag to move; use arrow keys to pan and plus or minus to zoom.');
        map.on('error', event => {
          if (disposed) return;
          console.error('[EZCLICK map]', event.error?.message, (event as unknown as {sourceId?: string}).sourceId ?? 'style');
          const source = (event as unknown as {sourceId?: string}).sourceId;
          if (source === 'elevation' || source === 'relief') {
            setTerrainError(true); setTerrainReady(false); setThreeD(false);
            map?.setTerrain(null);
          } else {
            setError('Some map details could not load. Check your connection or reload the map.');
          }
        });
        map.on('load', () => {
          if (disposed || !map) return;
          loaded = true; window.clearTimeout(timeout); setRadarMap(map); setReady(true); setError('');
          const elevation = {type: 'raster-dem' as const, url: TERRAIN_URL, tileSize: 512,
            encoding: 'terrarium' as const,
            attribution: '<a href="https://mapterhorn.com/" target="_blank" rel="noopener noreferrer">Elevation © Mapterhorn</a>'};
          map.addSource('elevation', elevation);
          map.addSource('relief', elevation);
          const before = map.getStyle().layers?.find(layer => layer.type === 'line' || layer.type === 'symbol')?.id;
          map.addLayer({id: 'terrain-shading', type: 'hillshade', source: 'relief', paint: {
            'hillshade-exaggeration': 0.28,
            'hillshade-shadow-color': '#596d79',
            'hillshade-highlight-color': '#ffffff',
            'hillshade-accent-color': '#81929a',
          }}, before);
          disposeVegetation=installSoftVegetation(map,lib);
          applyMapPalette(map);
          map.once('render',()=>{if(!disposed)setMapVisible(true);});
          // Interstate references are already in the vector tiles; expose shields at regional zoom.
          const shield='highway-shield-us-interstate';
          if(map.getLayer(shield)){
            // Interstate shield: red header, blue field, white border; route number comes from map data.
            const badge=document.createElement('canvas');badge.width=72;badge.height=80;
            const ctx=badge.getContext('2d');
            if(ctx){
              ctx.scale(2,2);
              const shape=new Path2D('M3 5 Q10 7 18 3 Q26 7 33 5 L32 21 Q30 31 18 37 Q6 31 4 21 Z');
              ctx.save();ctx.clip(shape);ctx.fillStyle='#174a8b';ctx.fillRect(0,0,36,40);
              ctx.fillStyle='#c83b43';ctx.fillRect(0,0,36,14);
              ctx.strokeStyle='#ffffff';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(3,14);ctx.lineTo(33,14);ctx.stroke();
              ctx.fillStyle='#ffffff';ctx.font='bold 4.5px Arial';ctx.textAlign='center';ctx.fillText('INTERSTATE',18,11.5);ctx.restore();
              ctx.strokeStyle='#ffffff';ctx.lineWidth=1.3;ctx.stroke(shape);
              map.addImage('ezclick-interstate-shield',ctx.getImageData(0,0,72,80),{pixelRatio:2});
              map.setLayoutProperty(shield,'icon-image','ezclick-interstate-shield');
              map.setLayoutProperty(shield,'text-offset',[0,.25]);
            }
            map.setLayerZoomRange(shield,6,24);
            map.setLayoutProperty(shield,'symbol-spacing',1500);
            // Tile fragments can repeat the same road shield: reserve screen space as well.
            map.setLayoutProperty(shield,'icon-allow-overlap',false);
            map.setLayoutProperty(shield,'text-allow-overlap',false);
            map.setLayoutProperty(shield,'icon-ignore-placement',false);
            map.setLayoutProperty(shield,'text-ignore-placement',false);
            map.setLayoutProperty(shield,'text-padding',['interpolate',['linear'],['zoom'],6,38,10,32,14,24]);
            map.setLayoutProperty(shield,'icon-padding',['interpolate',['linear'],['zoom'],6,38,10,32,14,24]);
            map.setLayoutProperty(shield,'icon-size',.85);
            map.setLayoutProperty(shield,'text-size',11);
            map.setLayoutProperty(shield,'text-pitch-alignment','viewport');
            map.setLayoutProperty(shield,'icon-pitch-alignment','viewport');
            map.setPaintProperty(shield,'text-color','#ffffff');
            map.setPaintProperty(shield,'text-halo-width',0);
          }
        });
        map.on('sourcedata', event => {
          if (!disposed && event.sourceId === 'relief' && event.isSourceLoaded) setTerrainReady(true);
        });
        observer = new ResizeObserver(() => map?.resize());
        observer.observe(container.current);
      } catch {
        if (!disposed) setError('The map could not start. Enable browser graphics acceleration and try again.');
      }
    }
    void initialize();
    return () => {disposed = true; window.clearTimeout(timeout); observer?.disconnect(); mapRef.current = null; scaleRef.current=null; map?.remove();disposeVegetation?.();};
  }, [attempt]);

  useEffect(() => {
    const sheet = sheetRef.current;
    const stage = sheet?.closest<HTMLElement>('.weather-map-stage');
    if (!sheet || !stage) return;
    const measure = () => {
      const box=stage.getBoundingClientRect(),panel=sheet.getBoundingClientRect();
      stage.style.setProperty('--weather-sheet-height', `${panel.height}px`);
      const compact=window.matchMedia('(max-width:767px), (max-width:950px) and (max-height:500px)').matches;
      const side=compact&&window.matchMedia('(orientation:landscape) and (max-height:500px)').matches;
      // Route panels overlay the map. Their animated height must not move the camera.
      const routeOverlay=compact&&sheet.classList.contains('mobile-route-shell');
      const bottom=compact&&!side?(routeOverlay?Math.min(284,Math.max(0,box.height-160)):Math.max(0,Math.min(box.height-100,box.bottom-panel.top))):0;
      const left=side?(routeOverlay?Math.min(350,Math.max(0,box.width-160)):Math.max(0,Math.min(box.width-160,panel.right-box.left))):0;
      stage.style.setProperty('--weather-map-left-inset', `${left}px`);
      stage.style.setProperty('--weather-map-bottom-inset', `${bottom}px`);
      // Keep the point-weather coordinates at the same visual center as the marker.
      const map=mapRef.current;
      if(map){
        const inset=map.getPadding();
        const changed=Math.abs((inset.bottom??0)-bottom)>.5||inset.top!==0||inset.right!==0||Math.abs((inset.left??0)-left)>.5;
        // setPadding calls jumpTo and cancels a flight, even for unchanged insets.
        // Let an active flight finish; moveend applies the latest measured sheet size.
        if(changed&&!map.isMoving()&&!map.getContainer().dataset.globeRotating)map.setPadding({top:0,right:0,bottom,left});
      }
    };
    const observer = new ResizeObserver(measure);
    const map=mapRef.current;
    map?.on('moveend',measure);
    observer.observe(sheet); observer.observe(stage); measure();
    return () => {map?.off('moveend',measure);observer.disconnect(); stage.style.removeProperty('--weather-sheet-height'); stage.style.removeProperty('--weather-map-bottom-inset'); stage.style.removeProperty('--weather-map-left-inset');};
  }, [ready]);

  // Follow the menu's animated height without resizing or moving the map camera.
  useEffect(()=>{
    const stage=sheetRef.current?.closest<HTMLElement>('.weather-map-stage');
    const menu=stage?.querySelector<HTMLElement>('.weather-globe-control');
    const actions=stage?.querySelector<HTMLElement>('.mobile-route-actions');
    if(!stage||!menu||!actions||!mobilePresentation)return;
    const measure=()=>{
      const box=stage.getBoundingClientRect(),tools=menu.getBoundingClientRect();
      const overlapsHorizontally=tools.right>box.left+actions.offsetLeft&&tools.left<box.left+actions.offsetLeft+actions.offsetWidth;
      const shift=overlapsHorizontally?Math.max(0,tools.bottom-box.top+12-actions.offsetTop):0;
      stage.style.setProperty('--weather-tools-shift',`${shift}px`);
    };
    const observer=new ResizeObserver(measure);
    observer.observe(menu);observer.observe(stage);if(sheetRef.current)observer.observe(sheetRef.current);
    measure();
    return()=>{observer.disconnect();stage.style.removeProperty('--weather-tools-shift');};
  },[mobilePresentation,ready,routeActive]);

  function animateGlobe() {
    if(globeFrame.current)return;
    let last=performance.now();
    const tick=(now:number)=>{
      globeFrame.current=0;
      const map=mapRef.current,target=globeTarget.current;if(!map||!target)return;
      const dt=Math.min(50,Math.max(0,now-last));last=now;
      const blend=window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:1-Math.exp(-dt/55);
      const difference=((target.bearing-map.getBearing()+540)%360+360)%360-180;
      const pitchDifference=target.pitch-map.getPitch();
      const settled=Math.abs(difference)+Math.abs(pitchDifference)<.03;
      if(settled&&!globeDrag.current){
        delete map.getContainer().dataset.globeRotating;
        globeTarget.current=null;
        map.jumpTo({bearing:target.bearing,pitch:target.pitch});
        return;
      }
      if(!settled)map.jumpTo({bearing:map.getBearing()+difference*blend,pitch:map.getPitch()+pitchDifference*blend});
      globeFrame.current=requestAnimationFrame(tick);
    };
    globeFrame.current=requestAnimationFrame(tick);
  }
  function startGlobe(event: PointerEvent<HTMLButtonElement>) {
    const map = mapRef.current;
    if (!map || !ready) return;
    event.preventDefault();map.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    globeDrag.current={id:event.pointerId,x:event.clientX,y:event.clientY,bearing:map.getBearing(),pitch:map.getPitch()};
    globeTarget.current={bearing:map.getBearing(),pitch:map.getPitch()};
    map.getContainer().dataset.globeRotating='true';
    animateGlobe();
  }
  function moveGlobe(event: PointerEvent<HTMLButtonElement>) {
    const start=globeDrag.current;
    if(!start||start.id!==event.pointerId)return;
    globeTarget.current={bearing:start.bearing+(event.clientX-start.x)*1.8,pitch:Math.max(0,Math.min(65,start.pitch-(event.clientY-start.y)*.8))};
  }
  function releaseGlobe(event: PointerEvent<HTMLButtonElement>) {
    if(globeDrag.current?.id!==event.pointerId)return;
    globeDrag.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function globeKey(event: KeyboardEvent<HTMLButtonElement>) {
    const map = mapRef.current;
    if (!map || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') map.easeTo({bearing: 0, pitch: 0, duration: 0});
    else map.jumpTo({bearing: map.getBearing() + (event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0), pitch: Math.max(0,Math.min(65,map.getPitch() + (event.key === 'ArrowUp' ? 5 : event.key === 'ArrowDown' ? -5 : 0)))});
  }

  function locateMe() {
    const map=mapRef.current;
    if(!map||!ready||locating)return;
    setLocationNoticeVisible(true);setLocationSucceeded(false);
    if(!navigator.geolocation){setLocationMessage('Location is not supported by this browser.');return;}
    setLocating(true);setLocationMessage('Finding your location…');
    const found=(position:GeolocationPosition)=>{
      if(mapRef.current!==map)return;
      const {longitude,latitude,accuracy}=position.coords;
      setLocationSucceeded(true);setLocationNoticeVisible(true);
      setLocating(false);
      map.flyTo({center:[longitude,latitude],zoom:accuracy>5000?10:13,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1400});
      setLocationMessage(accuracy>1000?'Approximate location · '+Math.round(accuracy/1000)+' km accuracy':'Your location · about '+Math.max(1,Math.round(accuracy))+' m accuracy');
    };
    const failed=(error:GeolocationPositionError)=>{
      if(mapRef.current!==map)return;
      setLocating(false);
      setLocationMessage(error.code===1?'Location access is blocked. Check browser and device location permissions.':error.code===3?'The browser did not return a location in time. Check device location services or try another browser.':'The browser could not determine your location. Check device location services or try another browser.');
    };
    navigator.geolocation.getCurrentPosition(found,error=>{
      if(mapRef.current!==map)return;
      if(error.code===1){failed(error);return;}
      setLocationMessage('Still finding your location…');
      navigator.geolocation.getCurrentPosition(found,failed,{enableHighAccuracy:true,timeout:20000,maximumAge:0});
    },{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
  }

  function toggleTerrain() {
    const map = mapRef.current;
    if (!map || !ready || !terrainReady || terrainError) return;
    const next = !threeD;
    map.setTerrain(next ? {source: 'elevation', exaggeration: 4.8} : null);
    map.easeTo({pitch: next ? 55 : 0, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 850});
    setThreeD(next);
  }

  return <main lang={language} data-language={language} className={`weather-workspace map-night${satellite?" satellite-active":""}${mobilePresentation?" weather-compact-ui":""}${widePresentation?" weather-wide-ui":""}${embeddedTrip ? " weather-trip-embed" : ""}`}>
    <header className="weather-map-header">
      <a className="weather-map-brand" href={platformUrl}><img src={brandImage.src} width={brandImage.width} height={brandImage.height} alt={brandImage.alt}/></a>
      <div dir={dir}><h1>{t("Explore the road ahead")}</h1><p>{t("Map & terrain preview")}</p></div>
      <WeatherVehicleMenu/>
      <button type="button" className="weather-header-units" onClick={toggleUnits} aria-label={units==='us'?'Units: Fahrenheit and miles. Switch to Celsius and kilometers':'Units: Celsius and kilometers. Switch to Fahrenheit and miles'} title={units==='us'?'Switch to °C · km':'Switch to °F · mi'}><span>{units==='us'?'°F · mi':'°C · km'}</span></button>
      <div ref={siteMenuRef} className={`weather-site-menu ${siteMenuOpen?"is-open":""}`}><button type="button" className="weather-site-menu-toggle" aria-expanded={siteMenuOpen} aria-controls="weather-site-links" onClick={()=>setSiteMenuOpen(v=>!v)}>{t("Menu")}<span aria-hidden="true">☰</span></button><nav id="weather-site-links" aria-label={t("Menu")} dir={dir} inert={!siteMenuOpen} aria-hidden={!siteMenuOpen}><a href={platformUrl}>{t("Home")}</a><a href="/terms">{t("About & weather disclaimer")}</a>{standaloneWeather()&&<button type="button" className="weather-support-toggle" onClick={()=>{setSiteMenuOpen(false);setSupportOpen(true);}}>{t("Report a problem")}</button>}<WeatherLanguageMenu/><WeatherQualityMenu/></nav></div>
    </header>
    <section className={`weather-map-stage ${standaloneWeather()&&!mobilePresentation?"desktop-route-ui":""}`} aria-label="Map and terrain preview">
      <div ref={container} className={`weather-map-canvas${mapVisible?" is-map-visible":""}`} />
      {satellite&&<SatelliteBasemap map={radarMap} ready={ready} units={units}/> }
      <div ref={cameraControlsRef} className={`weather-globe-control ${cameraExpanded?'camera-expanded':''}`} onKeyDown={event=>{if(event.key==='Escape'&&!legendOpen){if(mobilePresentation)cameraToggleRef.current?.focus({preventScroll:true});setCameraExpanded(false);}}}>
        <button ref={cameraToggleRef} type="button" className="camera-menu-toggle camera-location" aria-label="Map controls" aria-expanded={cameraExpanded} aria-controls="weather-camera-tools" onClick={()=>{setCameraExpanded(v=>!v);setLegendOpen(false);}}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-dark" d="m4 22 12-6 12 6-12 6Z"/><path className="icon-mid" d="m4 16 12-6 12 6-12 6Z"/><path className="icon-light" d="m4 10 12-6 12 6-12 6Z"/></svg></button>
        <SatelliteControl mode={satelliteMode} ready={ready} onChange={mode=>{setSatelliteMode(mode);setCameraExpanded(false);}}>{satellite&&<SatellitePreview map={radarMap} ready={ready}/>}</SatelliteControl>
        <div className="weather-camera-tools" id="weather-camera-tools" inert={mobilePresentation&&!cameraExpanded} aria-hidden={mobilePresentation&&!cameraExpanded}><div className="weather-camera-tools-inner">
        <button type="button" className="map-icon-button terrain-toggle" onClick={toggleTerrain} aria-pressed={threeD} aria-label="3D terrain" data-tooltip={threeD ? 'Switch to 2D' : 'Switch to 3D'} disabled={!ready || !terrainReady || terrainError}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-shadow" d="m3 23 13-7 13 7-13 7Z"/><path className="icon-dark" d="m4 20 12-6 12 6-12 7Z"/><path className="icon-light" d={threeD?'m4 20 7-12 5 6 4-9 8 15-12 5Z':'m4 17 12-6 12 6-12 6Z'}/><path className="icon-mid" d={threeD?'m11 8 5 17-12-5Zm9-3 8 15-12 5Z':'m4 17 12 6v4L4 21Z'}/></svg><span>{threeD ? '3D' : '2D'}</span></button>
        <button type="button" className="map-icon-button top-view" aria-label="Top view" data-tooltip="Top view" disabled={!ready} onClick={() => mapRef.current?.easeTo({bearing:0,pitch:0,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600})}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-shadow" d="m4 22 12-6 12 6-12 7Z"/><path className="icon-dark" d="m4 19 12-6 12 6-12 7Z"/><path className="icon-light" d="m5 16 11-5 11 5-11 6Z"/><path d="M16 3v10m-4-4 4 4 4-4" stroke="#d1f7ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg><span>{t('Top')}</span></button><RoadControls map={radarMap} ready={ready} />
        <button type="button" id="weather-legend-toggle" className="map-icon-button" aria-label={t("Legend")} title={t("Legend")} aria-expanded={legendOpen} aria-controls="weather-legend" onClick={()=>setLegendOpen(v=>!v)}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 8h20M6 16h20M6 24h20" stroke="#92d7e6" strokeWidth="3" strokeLinecap="round"/><circle cx="11" cy="8" r="3" fill="#b9d9e7"/><circle cx="20" cy="16" r="3" fill="#b9d9e7"/><circle cx="15" cy="24" r="3" fill="#b9d9e7"/></svg><span>{t('Legend button')}</span></button></div></div><button type="button" className="map-icon-button route-mode-toggle" aria-label="Plan route" data-tooltip="Plan route" aria-pressed={routeCitiesOpen} disabled={!ready} onClick={()=>{const next=!routeCitiesOpen;setRouteCitiesOpen(next);setRouteActive(next);setRouteInfoOpen(true);if(mobilePresentation)settleSheet(false);}}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-shadow" d="m11 7 10 0 8 23H3Z"/><path className="icon-dark" d="M12 4h8l7 23H5Z"/><path className="icon-light" d="M12 4h2L9 27H5Zm6 0h2l7 23h-4Z"/><path className="icon-mid" d="M5 27h22v2H5Z"/><path d="M16 6v4m0 4v4m0 4v4" fill="none" stroke="#d1f7ff" strokeWidth="1.5" strokeLinecap="round"/></svg><span>{t('Route')}</span></button><div className="location-control">
          <button type="button" className="camera-location" disabled={!ready||locating} onClick={locateMe} aria-label={locating?'Finding your location':'Go to my location'} data-tooltip="My location" aria-busy={locating}>
            <svg viewBox="0 0 32 32" aria-hidden="true"><path className="location-arrow-shadow" d="M7 17 26 7 19 28 15 20Z"/><path className="location-arrow-light" d="m6 14 20-9-8 20-3-8Z"/><path className="location-arrow-dark" d="m26 5-11 12 3 8Z"/></svg>
          </button>

        </div>
        <div className={`location-feedback ${locationNoticeVisible?"is-visible":""}`} role="status" aria-hidden={!locationNoticeVisible} inert={!locationNoticeVisible}><span>{locationMessage}</span>{!locating&&<button type="button" aria-label="Dismiss location message" onClick={()=>setLocationNoticeVisible(false)}>×</button>}</div>
      </div>
      <div className="weather-corner-globe">
        <span className="globe-north">N</span>
        <button type="button" className="camera-globe" disabled={!ready} aria-label="Rotate and tilt map" aria-describedby="globe-help" onPointerDown={startGlobe} onPointerMove={moveGlobe} onPointerUp={releaseGlobe} onPointerCancel={releaseGlobe} onLostPointerCapture={() => {globeDrag.current = null;}} onKeyDown={globeKey}>
          <svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="33"/><g style={{transform: 'rotate(' + (-camera.bearing) + 'deg)', transformOrigin: '40px 40px'}}><ellipse cx="40" cy="40" rx="16" ry="33"/><path d="M7 40h66M12 23q28 15 56 0M12 57q28-15 56 0"/><path className="globe-land" d="M22 18l13 5 4 12-8 6 2 12-9 9-5-18 4-9-5-7zM48 25l12 3 4 11-10 6-7-8z"/></g><circle className="globe-camera-dot" cx="40" cy={65 - camera.pitch * 0.65} r="3"/></svg>
        </button>
        <span id="globe-help">Drag to rotate & tilt</span>
      </div>
      {typeof window!=="undefined"&&(import.meta.env.VITE_PUBLIC_VOICE_BETA==="1"||new URLSearchParams(window.location.search).get("voice-preview")==="1")&&<VoiceRouteDrawer onVisibilityChange={setVoicePanelOpen} suspended={legendOpen||siteMenuOpen||supportOpen} onConfirm={trip=>window.dispatchEvent(new CustomEvent("weather-voice-trip",{detail:trip}))}/>}
      <div className={`weather-resume-collapse ${resumeAvailable&&!routeActive?'is-visible':''}`} inert={!resumeAvailable||routeActive} aria-hidden={!resumeAvailable||routeActive}><button type="button" disabled={!ready} onClick={()=>{setRouteCitiesOpen(false);setRouteActive(true);setRouteInfoOpen(true);setResumeRequest(v=>v+1);if(mobilePresentation)settleSheet(false);}}><strong>{t('Continue route')}</strong><small>{t('Saved trip · fresh forecast')}</small></button></div><WeatherLegend open={legendOpen} onClose={()=>setLegendOpen(false)} map={radarMap} units={units}/><WeatherCenterMarker /><div ref={sheetRef} inert={voicePanelOpen||(mobilePresentation&&routeActive&&!routeInfoOpen)} aria-hidden={voicePanelOpen||undefined} className={`weather-left-stack ${voicePanelOpen?"is-behind-voice":""} ${routeActive?"route-active":""} ${mobilePresentation&&routeActive?"mobile-route-shell":""} ${mobilePresentation&&routeActive&&!routeInfoOpen?"route-info-hidden":""} ${mobileExpanded?"mobile-expanded":""}`}><button type="button" className="weather-mobile-expand" aria-label={routeActive?(mobileExpanded?"Collapse route forecasts":"Expand route forecasts"):(mobileExpanded?"Close weather settings":"Open weather settings")} aria-expanded={mobileExpanded} onPointerDown={beginSheet} onPointerMove={pullSheet} onPointerUp={releaseSheet} onPointerCancel={()=>{sheetDrag.current=null;settleSheet(mobileExpanded);}} onClick={()=>{if(skipSheetClick.current){skipSheetClick.current=false;return;}settleSheet(!mobileExpanded);}}><span className="sheet-grip" aria-hidden="true"/><span className="sheet-grip-label">{mobileExpanded?"Swipe down to collapse":routeActive?"Swipe up for more forecasts":"Swipe up for settings"}</span></button><WeatherRoute resumeRequest={resumeRequest} map={radarMap} active={routeActive} citiesOnly={routeCitiesOpen} onClear={()=>{setResumeAvailable(false);setRouteCitiesOpen(false);setRouteActive(false);setRouteInfoOpen(true);settleSheet(false);}} mobilePresentation={mobilePresentation} onShowInfo={()=>{setRouteCitiesOpen(false);setRouteActive(true);setRouteInfoOpen(true);}} onClose={()=>{setRouteCitiesOpen(false);setRouteActive(false);setRouteInfoOpen(true);if(mobilePresentation)settleSheet(false);}} compactMobile={(mobilePortrait||widePresentation)&&!mobileExpanded} onExpand={()=>{if(mobilePortrait||widePresentation)settleSheet(true);}}/><PointWeather map={radarMap} ready={ready} time={weatherTime} windFrames={windData.frames} units={units} onToggleUnits={toggleUnits} /><WindControls map={radarMap} ready={ready} time={weatherTime} frames={windData.frames} status={windData.status} units={units} /><RadarControls map={radarMap} ready={ready} onTimeChange={setWeatherTime} units={units} cloudObservations={satellite} /></div>

      {!ready && !error && <p className="weather-map-message" role="status">{t('Loading your map…')}</p>}
      {error && <div className="weather-map-message" role="alert"><p>{error}</p><button type="button" onClick={() => {setMapVisible(false); setReady(false); setTerrainReady(false); setThreeD(false); setError(''); setTerrainError(false); setAttempt(value => value + 1);}}>Reload map</button></div>}
      {terrainError && !error && <p className="weather-map-message" role="status">Elevation is temporarily unavailable. You can still explore the base map.</p>}
      <aside className="weather-map-note"><strong>Your map. Your perspective.</strong><p>Drag to explore · Scroll to zoom · Pinch on mobile</p><span>Enable Rain radar to see recent precipitation echoes.</span></aside>
    </section>
    {standaloneWeather()&&<WeatherSupport open={supportOpen} onClose={()=>setSupportOpen(false)} returnFocus={siteMenuRef} context={{language,quality,units,map:error?"unavailable":terrainError?"terrain-unavailable":ready?"ready":"loading",routeActive}}/>}
  </main>;
}
