"use client";

import {useEffect, useRef, useState, type PointerEvent, type KeyboardEvent} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './weather-map.css';
import RadarControls from './radar-controls';
import RoadControls from './road-controls';

import PointWeather from './point-weather';
import WindControls from './wind-controls';
import {useWindFields} from './wind-field';
import {useWeatherUnits} from './weather-units';
import {installSoftVegetation} from './soft-vegetation';

const INITIAL_VIEW = {center: [-105.6, 39.65] as [number, number], zoom: 8};
const TERRAIN_URL = 'https://tiles.mapterhorn.com/tilejson.json';


// Apply the permanent night palette without changing sources or terrain.
function applyMapPalette(map: LibreMap) {
  const paint = (id: string, property: Parameters<LibreMap['setPaintProperty']>[1], color: string | number) => {
    map.setPaintProperty(id, property, color);
  };
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id;
    if (id === 'soft-vegetation') continue;
    if (layer.type === 'background') paint(id, 'background-color', '#14283d');
    if (layer.type === 'fill') {
      const color = id === 'water' ? '#08192c' : /park|wood/.test(id) ? '#1a3043' : /glacier|ice/.test(id) ? '#345069' : /building/.test(id) ? '#284359' : '#1b3147';
      paint(id, 'fill-color', color);
      if (id === 'park' || id === 'landcover_wood') paint(id, 'fill-opacity', 0);
      if (layer.paint && 'fill-outline-color' in layer.paint) paint(id, 'fill-outline-color', '#344f64');
    }
    if (layer.type === 'line') {
      const color = /water/.test(id) ? '#265269' : /boundary/.test(id) ? '#304458' : /casing/.test(id) ? '#102235' : /motorway.*inner/.test(id) ? '#c5bda8' : /major.*inner/.test(id) ? '#a59f90' : /railway/.test(id) ? '#405a70' : '#49677f';
      paint(id, 'line-color', color);
    }
    if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
      paint(id, 'text-color', /water/.test(id) ? '#91bdce' : /highway|shield|road_shield/.test(id) ? '#c1d2df' : '#e0ebf3');
      paint(id, 'text-halo-color', '#102338');
      paint(id, 'text-halo-width', 1.5);
    }
    if (id === 'terrain-shading') {
      paint(id, 'hillshade-shadow-color', '#030c1b');
      paint(id, 'hillshade-highlight-color', '#66839b');
      paint(id, 'hillshade-accent-color', '#36566e');
      // Hillshade intensity only; terrain geometry and elevation resolution are unchanged.
      paint(id, 'hillshade-exaggeration', 0.4);
    }
  }
}

export default function WeatherMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const [weatherTime,setWeatherTime]=useState<number|null>(null);
  const [mobileExpanded,setMobileExpanded]=useState(false);
  const [cameraExpanded,setCameraExpanded]=useState(false);
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
      sheet.style.transition='none';sheet.style.height='auto';
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

  const [ready, setReady] = useState(false);
  const windData=useWindFields(ready);
  const {units,toggle:toggleUnits}=useWeatherUnits();
  const [radarMap, setRadarMap] = useState<LibreMap | null>(null);
  const [terrainReady, setTerrainReady] = useState(false);
  const [threeD, setThreeD] = useState(false);
  const [error, setError] = useState('');
  const [terrainError, setTerrainError] = useState(false);
  const [locating,setLocating]=useState(false);
  const [locationMessage,setLocationMessage]=useState('');
  const [attempt, setAttempt] = useState(0);
  const globeDrag = useRef<{id: number; x: number; y: number; bearing: number; pitch: number} | null>(null);
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
          dragPan: true,
          scrollZoom: true,
          touchZoomRotate: true,
          attributionControl: false,
        });
        mapRef.current = map;
        map.on('move', () => {if (!disposed && map) setCamera({bearing: map.getBearing(), pitch: map.getPitch()});});

        map.addControl(new lib.ScaleControl({unit: 'imperial'}), 'bottom-left');
        map.addControl(new lib.AttributionControl({compact: false, customAttribution: '<a href="https://github.com/cwdaniel/RadrView" target="_blank" rel="noopener noreferrer">Wind animation: RadrView</a>'}), 'bottom-right');
        map.getCanvas().setAttribute('aria-label', 'Interactive EZCLICK map. Drag to move; use arrow keys to pan and plus or minus to zoom.');
        map.on('error', event => {
          if (disposed) return;
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
    return () => {disposed = true; window.clearTimeout(timeout); observer?.disconnect(); mapRef.current = null; map?.remove();disposeVegetation?.();};
  }, [attempt]);

  function startGlobe(event: PointerEvent<HTMLButtonElement>) {
    const map = mapRef.current;
    if (!map || !ready) return;
    event.preventDefault(); map.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    globeDrag.current = {id: event.pointerId, x: event.clientX, y: event.clientY, bearing: map.getBearing(), pitch: map.getPitch()};
  }
  function moveGlobe(event: PointerEvent<HTMLButtonElement>) {
    const start = globeDrag.current, map = mapRef.current;
    if (!start || start.id !== event.pointerId || !map) return;
    map.jumpTo({bearing: start.bearing + (event.clientX - start.x) * 1.8, pitch: Math.max(0, Math.min(65, start.pitch - (event.clientY - start.y) * 0.8))});
  }
  function releaseGlobe(event: PointerEvent<HTMLButtonElement>) {
    if (globeDrag.current?.id !== event.pointerId) return;
    globeDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
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
    if(!navigator.geolocation){setLocationMessage('Location is not supported by this browser.');return;}
    setLocating(true);setLocationMessage('Finding your location…');
    const found=(position:GeolocationPosition)=>{
      if(mapRef.current!==map)return;
      const {longitude,latitude,accuracy}=position.coords;
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
    map.setTerrain(next ? {source: 'elevation', exaggeration: 1.2} : null);
    map.easeTo({pitch: next ? 55 : 0, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 850});
    setThreeD(next);
  }

  return <main className="weather-workspace map-night">
    <header className="weather-map-header">
      <a className="weather-map-brand" href="./">EZCLICK <span>GO</span></a>
      <div><h1>Explore the road ahead</h1><p>Map & terrain preview</p></div>
      <a className="weather-map-back" href="./">Back to home</a>
    </header>
    <section className="weather-map-stage" aria-label="Map and terrain preview">
      <div ref={container} className="weather-map-canvas" />
      <div className={`weather-globe-control ${cameraExpanded?'camera-expanded':''}`} onKeyDown={event=>{if(event.key==='Escape')setCameraExpanded(false);}}>
        <button type="button" className="camera-menu-toggle camera-location" aria-label="Map controls" aria-expanded={cameraExpanded} aria-controls="weather-camera-tools" onClick={()=>setCameraExpanded(v=>!v)}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-dark" d="m4 22 12-6 12 6-12 6Z"/><path className="icon-mid" d="m4 16 12-6 12 6-12 6Z"/><path className="icon-light" d="m4 10 12-6 12 6-12 6Z"/></svg></button>
        <div className="weather-camera-tools" id="weather-camera-tools">
        <button type="button" className="map-icon-button terrain-toggle" onClick={toggleTerrain} aria-pressed={threeD} aria-label="3D terrain" title={threeD ? 'Switch to 2D' : 'Switch to 3D'} disabled={!ready || !terrainReady || terrainError}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-shadow" d="m3 23 13-7 13 7-13 7Z"/><path className="icon-dark" d="m4 20 12-6 12 6-12 7Z"/><path className="icon-light" d={threeD?'m4 20 7-12 5 6 4-9 8 15-12 5Z':'m4 17 12-6 12 6-12 6Z'}/><path className="icon-mid" d={threeD?'m11 8 5 17-12-5Zm9-3 8 15-12 5Z':'m4 17 12 6v4L4 21Z'}/></svg><span>{threeD ? '3D' : '2D'}</span></button>
        <span className="globe-north">N</span>
        <button type="button" className="camera-globe" disabled={!ready} aria-label="Rotate and tilt map" aria-describedby="globe-help" onPointerDown={startGlobe} onPointerMove={moveGlobe} onPointerUp={releaseGlobe} onPointerCancel={releaseGlobe} onLostPointerCapture={() => {globeDrag.current = null;}} onKeyDown={globeKey}>
          <svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="33"/><g style={{transform: 'rotate(' + (-camera.bearing) + 'deg)', transformOrigin: '40px 40px'}}><ellipse cx="40" cy="40" rx="16" ry="33"/><path d="M7 40h66M12 23q28 15 56 0M12 57q28-15 56 0"/><path className="globe-land" d="M22 18l13 5 4 12-8 6 2 12-9 9-5-18 4-9-5-7zM48 25l12 3 4 11-10 6-7-8z"/></g><circle className="globe-camera-dot" cx="40" cy={65 - camera.pitch * 0.65} r="3"/></svg>
        </button>
        <span id="globe-help">Drag to rotate & tilt</span>
        <button type="button" className="map-icon-button top-view" aria-label="Top view" disabled={!ready} onClick={() => mapRef.current?.easeTo({bearing:0,pitch:0,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600})}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-shadow" d="m4 22 12-6 12 6-12 7Z"/><path className="icon-dark" d="m4 19 12-6 12 6-12 7Z"/><path className="icon-light" d="m5 16 11-5 11 5-11 6Z"/><path d="M16 3v10m-4-4 4 4 4-4" stroke="#d1f7ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg><span>Top</span></button><RoadControls map={radarMap} ready={ready} />
        </div><div className="location-control">
          <button type="button" className="camera-location" disabled={!ready||locating} onClick={locateMe} aria-label={locating?'Finding your location':'Go to my location'} aria-describedby="location-tip" aria-busy={locating}>
            <svg viewBox="0 0 32 32" aria-hidden="true"><path className="location-arrow-shadow" d="M7 17 26 7 19 28 15 20Z"/><path className="location-arrow-light" d="m6 14 20-9-8 20-3-8Z"/><path className="location-arrow-dark" d="m26 5-11 12 3 8Z"/></svg>
          </button>
          <span className="location-tooltip" id="location-tip">My location</span>
        </div>
        {locationMessage&&<div className="location-feedback" role="status"><span>{locationMessage}</span>{!locating&&<button type="button" aria-label="Dismiss location message" onClick={()=>setLocationMessage('')}>×</button>}</div>}
      </div>
      <div className="weather-center-dot" aria-hidden="true" /><div ref={sheetRef} className={`weather-left-stack ${mobileExpanded?"mobile-expanded":""}`}><button type="button" className="weather-mobile-expand" aria-label={mobileExpanded?"Close weather settings":"Open weather settings"} aria-expanded={mobileExpanded} onPointerDown={beginSheet} onPointerMove={pullSheet} onPointerUp={releaseSheet} onPointerCancel={()=>{sheetDrag.current=null;settleSheet(mobileExpanded);}} onClick={()=>{if(skipSheetClick.current){skipSheetClick.current=false;return;}settleSheet(!mobileExpanded);}}><span className="sheet-grip" aria-hidden="true"/><span className="sheet-grip-label">{mobileExpanded?"Swipe down to close":"Swipe up for settings"}</span></button><PointWeather map={radarMap} ready={ready} time={weatherTime} windFrames={windData.frames} units={units} onToggleUnits={toggleUnits} /><WindControls map={radarMap} ready={ready} time={weatherTime} frames={windData.frames} status={windData.status} units={units} /><RadarControls map={radarMap} ready={ready} onTimeChange={setWeatherTime} /></div>

      {!ready && !error && <p className="weather-map-message" role="status">Loading your map…</p>}
      {error && <div className="weather-map-message" role="alert"><p>{error}</p><button type="button" onClick={() => {setReady(false); setTerrainReady(false); setThreeD(false); setError(''); setTerrainError(false); setAttempt(value => value + 1);}}>Reload map</button></div>}
      {terrainError && !error && <p className="weather-map-message" role="status">Elevation is temporarily unavailable. You can still explore the base map.</p>}
      <aside className="weather-map-note"><strong>Your map. Your perspective.</strong><p>Drag to explore · Scroll to zoom · Pinch on mobile</p><span>Enable Rain radar to see recent precipitation echoes.</span></aside>
    </section>
  </main>;
}

