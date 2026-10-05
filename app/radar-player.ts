import type {MotionRenderer} from './precip-motion';
import type {ImageSource, Map as LibreMap} from 'maplibre-gl';

export const RADAR_SOURCE = 'noaa-radar-composite';
const CYCLE_MS = 12000;

// Mix premultiplied colors additively. Two overlapping fading map layers use
// source-over compositing, which causes a dip in alpha halfway through a fade.
export function blendRadar(context: CanvasRenderingContext2D, first: CanvasImageSource, second: CanvasImageSource, mix: number) {
  const weight = Math.max(0, Math.min(1, mix));
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1 - weight;
  context.drawImage(first, 0, 0);
  if (weight > 0) {
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = weight;
    context.drawImage(second, 0, 0);
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
}

export function createRadarPlayer(map: LibreMap, images: HTMLCanvasElement[], onPosition: (position:number) => void, onSmoothPosition?: (position:number) => void, motion?:MotionRenderer|null) {
  const canvas = document.createElement('canvas');
  canvas.width = images[0].width; canvas.height = images[0].height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Radar canvas unavailable');
  const snapshot = document.createElement('canvas');
  snapshot.width=canvas.width; snapshot.height=canvas.height;
  const snapshotContext=snapshot.getContext('2d');
  const target=document.createElement('canvas'); target.width=canvas.width; target.height=canvas.height;
  const targetContext=target.getContext('2d');
  if (!snapshotContext || !targetContext) throw new Error('Radar blend unavailable');
  let position=images.length-1, playing=false, raf=0, last=0, seekStart=0, seeking=false, lastUi=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const drawPosition=(ctx:CanvasRenderingContext2D, value:number) => {
    const base=Math.floor(value)%images.length;
    if(!reduced&&motion?.draw(ctx,base,value-Math.floor(value)))return;
    blendRadar(ctx,images[base],images[(base+1)%images.length],value-Math.floor(value));
  };
  drawPosition(context,position);
  map.addSource(RADAR_SOURCE,{type:'image',url:canvas.toDataURL('image/png'),coordinates:[[-130,52],[-60,52],[-60,22],[-130,22]]});
  const before=map.getStyle().layers?.find(layer => layer.type==='symbol')?.id;
  map.addLayer({id:RADAR_SOURCE,type:'raster',source:RADAR_SOURCE,paint:{'raster-opacity':0.65,'raster-opacity-transition':{duration:180,delay:0},'raster-fade-duration':0}},before);
  const source=map.getSource(RADAR_SOURCE) as ImageSource;
  // ImageSource's public updateImage path invalidates all draped terrain tiles.
  // CanvasSource updates only invalidate its canonical tile in MapLibre 6.11.
  function publish() {
    // Continue updating the geographic layer during camera gestures.
    source.updateImage({image:canvas});map.triggerRepaint();
  }
  const resumePublish=()=>publish();
  map.on('moveend',resumePublish);
  publish();

  let lastDraw:number|null=null;
  function tick(now:number) {
    raf=0;
    // Move the timeline every display frame; map image uploads remain capped at 30 fps.
    if(playing){const elapsed=last?Math.min(now-last,100):0;onSmoothPosition?.(Math.min((position+elapsed*images.length/CYCLE_MS)%images.length,images.length-1));}
    // Preserve the frame phase: resetting to now loses fractional display time
    // and turns a 30 fps target into uneven 20 fps on a 60 Hz display.
    // Terrain uploads cost more during movement; retain motion at 20 fps, idle at 30.
    const frameInterval=1000/((map.isMoving()||map.getContainer().dataset.globeRotating)?20:30);
    if(lastDraw===null) lastDraw=now;
    else {
      const steps=Math.floor((now-lastDraw+0.01)/frameInterval);
      if(steps<1){raf=requestAnimationFrame(tick);return;}
      lastDraw+=steps*frameInterval;
    }
    if (playing) {
      const elapsed=last ? Math.min(now-last,100) : 0;
      position=(position+elapsed*images.length/CYCLE_MS)%images.length;
      drawPosition(context!,reduced ? Math.floor(position) : position);
      if(now-lastUi>=50) {onPosition(Math.min(position,images.length-1));lastUi=now;}
    } else if(seeking) {
      const t=reduced || now-seekStart>=300 ? 1 : 1-Math.exp(-Math.max(1,last?now-last:16)/65);
      snapshotContext!.clearRect(0,0,canvas.width,canvas.height);snapshotContext!.drawImage(canvas,0,0);
      blendRadar(context!,snapshot,target,t);
      if(t===1) seeking=false;
    }
    publish();
    last=now;
    if(playing || seeking) raf=requestAnimationFrame(tick);
    else {map.triggerRepaint();}
  }
  function wake() {if(!raf){last=0;lastDraw=null;raf=requestAnimationFrame(tick);}}
  return {
    position() {return Math.min(position,images.length-1);},
    replace(next:HTMLCanvasElement[],nextPosition:number,nextMotion?:MotionRenderer|null) {
      motion?.dispose();motion=nextMotion;
      snapshotContext.clearRect(0,0,canvas.width,canvas.height);snapshotContext.drawImage(canvas,0,0);
      images=next;position=Math.max(0,Math.min(next.length-1,nextPosition));
      drawPosition(targetContext,position);seeking=!playing;seekStart=performance.now();onPosition(position);wake();
    },
    play(next:boolean) {playing=next;seeking=false;if(next) wake();else {if(raf)cancelAnimationFrame(raf);raf=0;onPosition(Math.min(position,images.length-1));}},
    seek(value:number) {
      playing=false;
      snapshotContext.clearRect(0,0,canvas.width,canvas.height);snapshotContext.drawImage(canvas,0,0);
      position=Math.max(0,Math.min(images.length-1,value));drawPosition(targetContext,position);
      seeking=true;seekStart=performance.now();onPosition(position);wake();
    },
    opacity(value:number) {if(map.getLayer(RADAR_SOURCE))map.setPaintProperty(RADAR_SOURCE,'raster-opacity',value);},
    dispose() {map.off('moveend',resumePublish);motion?.dispose();if(raf)cancelAnimationFrame(raf);if(map.getLayer(RADAR_SOURCE))map.removeLayer(RADAR_SOURCE);if(map.getSource(RADAR_SOURCE))map.removeSource(RADAR_SOURCE);for(const image of [...images,canvas,snapshot,target]){image.width=1;image.height=1;}},
  };
}


