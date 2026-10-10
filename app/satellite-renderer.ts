import type {Map as LibreMap} from 'maplibre-gl';

/** Preserve detailed tiles while zooming; advance observations only when ready. */
export function createSatelliteRenderer(map: LibreMap, frames: {time: number}[]) {
  const active = new Map<number, string>(), opacity = new Map<string, number>();
  let shown: number[] = [], order = '', disposed = false, failure: Error | null = null;
  let moving = map.isMoving(), settling = false, idleTimer: ReturnType<typeof setTimeout> | undefined;
  const before = map.getStyle().layers?.find(layer => layer.type === 'line' || layer.type === 'symbol')?.id;
  const onError = (event: {sourceId?: string; error: unknown}) => {
    if (event.sourceId && [...active.values()].includes(event.sourceId))
      failure = new Error('Some satellite tiles could not load. Retry to continue.');
  };
  const remove = (index: number) => {
    const id = active.get(index); if (!id) return;
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
    active.delete(index); opacity.delete(id); order = '';
  };
  const setOpacity = (id: string, value: number) => {
    if (opacity.get(id) === value) return;
    map.setPaintProperty(id, 'raster-opacity', value); opacity.set(id, value);
  };
  const ensure = (index: number) => {
    let id = active.get(index); if (id) return id;
    id = 'ezclick-cloud-frame-' + index; active.set(index, id); opacity.set(id, 0);
    map.addSource(id, {type: 'raster', tiles: ['/satellite-tiles/' + frames[index].time + '/{z}/{x}/{y}.png?v=3'],
      tileSize: 256, maxzoom: 7,
      attribution: 'Cloud observations: <a href="https://worldview.earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA GIBS</a> · CIRA/NOAA · MODIS/VIIRS'});
    map.addLayer({id, type: 'raster', source: id, paint: {
      'raster-opacity': 0, 'raster-opacity-transition': {duration: 0, delay: 0},
      'raster-fade-duration': 0, 'raster-resampling': 'linear',
    }}, before);
    order = ''; return id;
  };
  const onMoveStart = () => {
    moving = true; settling = false; clearTimeout(idleTimer);
    // Keep the displayed sources and their detailed tile pyramids intact.
    // Only future observations stop competing for the new viewport.
    if (shown.length) for (const index of active.keys()) if (!shown.includes(index)) remove(index);
  };
  const onMoveEnd = () => {
    moving = false; settling = true; clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {settling = false;}, 180);
  };
  map.on('error', onError); map.on('movestart', onMoveStart); map.on('moveend', onMoveEnd);
  return {
    draw(position: number) {
      if (disposed || !frames.length) return false;
      if (failure) throw failure;
      if (moving || settling) return false;
      const value = Math.max(0, Math.min(frames.length - .000001, position));
      const a = Math.floor(value), b = (a + 1) % frames.length, next = (b + 1) % frames.length;
      const wanted = new Set([...shown, a, b, next]);
      for (const index of active.keys()) if (!wanted.has(index)) remove(index);
      const lower = ensure(a);
      if (!map.isSourceLoaded(lower) && !shown.length) return false;
      const upper = ensure(b);
      if (!map.isSourceLoaded(lower) || !map.isSourceLoaded(upper)) {
        if (!shown.length && map.isSourceLoaded(lower)) {setOpacity(lower, 1); shown = [a];}
        return false;
      }
      const key = a + ':' + b;
      if (order !== key) {
        map.moveLayer(lower, before); map.moveLayer(upper, before);
        order = key;
      }
      for (const [index, id] of active) setOpacity(id, index === a ? 1 : index === b ? value - a : 0);
      shown = [a, b];
      for (const index of active.keys()) if (![a, b, next].includes(index)) remove(index);
      ensure(next);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; clearTimeout(idleTimer);
      map.off('error', onError); map.off('movestart', onMoveStart); map.off('moveend', onMoveEnd);
      for (const index of active.keys()) remove(index);
    },
  };
}
