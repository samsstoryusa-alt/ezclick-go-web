import type {ImageSource, Map as LibreMap} from 'maplibre-gl';

export const RADAR_SOURCE = 'noaa-radar-composite';
const CYCLE_MS = 3500;

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

export function createRadarPlayer(map: LibreMap, images: HTMLCanvasElement[], onPosition: (position:number) => void, onSmoothPosition?: (position:number) => void) {
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
    blendRadar(ctx,images[base],images[(base+1)%images.length],value-Math.floor(value));
  };
  drawPosition(context,position);
  map.addSource(RADAR_SOURCE,{type:'image',url:canvas.toDataURL('image/png'),coordinates:[[-130,52],[-60,52],[-60,22],[-130,22]]});
  const before=map.getStyle().layers?.find(layer => layer.type==='symbol')?.id;
  map.addLayer({id:RADAR_SOURCE,type:'raster',source:RADAR_SOURCE,paint:{'raster-opacity':0.65,'raster-opacity-transition':{duration:180,delay:0},'raster-fade-duration':0}},before);
  const source=map.getSource(RADAR_SOURCE) as ImageSource;
  // ImageSource's public updateImage path invalidates all draped terrain tiles.
  // CanvasSource updates only invalidate its canonical tile in MapLibre 6.11.
  function publish() {source.updateImage({image:canvas});map.triggerRepaint();}
  publish();
  let lastDraw=0;
  function tick(now:number) {
    raf=0;
    // Move the timeline every display frame; map image uploads remain capped at 30 fps.
    if(playing){const elapsed=last?Math.min(now-last,100):0;onSmoothPosition?.(Math.min((position+elapsed*images.length/CYCLE_MS)%images.length,images.length-1));}
    if(now-lastDraw<1000/30){raf=requestAnimationFrame(tick);return;}
    lastDraw=now;
    if (playing) {
      const elapsed=last ? Math.min(now-last,100) : 0;
      position=(position+elapsed*images.length/CYCLE_MS)%images.length;
      drawPosition(context!,reduced ? Math.floor(position) : position);
      if(now-lastUi>=50) {onPosition(Math.min(position,images.length-1));lastUi=now;}
    } else if(seeking) {
      const t=reduced ? 1 : Math.min(1,(now-seekStart)/140);
      blendRadar(context!,snapshot,target,t*t*(3-2*t));
      if(t===1) seeking=false;
    }
    publish();
    last=now;
    if(playing || seeking) raf=requestAnimationFrame(tick);
    else {map.triggerRepaint();}
  }
  function wake() {if(!raf){last=0;raf=requestAnimationFrame(tick);}}
  return {
    position() {return Math.min(position,images.length-1);},
    replace(next:HTMLCanvasElement[],nextPosition:number) {
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
    dispose() {if(raf)cancelAnimationFrame(raf);if(map.getLayer(RADAR_SOURCE))map.removeLayer(RADAR_SOURCE);if(map.getSource(RADAR_SOURCE))map.removeSource(RADAR_SOURCE);for(const image of [...images,canvas,snapshot,target]){image.width=1;image.height=1;}},
  };
}
