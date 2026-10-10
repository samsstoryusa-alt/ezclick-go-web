import type {Map as LibreMap} from 'maplibre-gl';
import type {WeatherUnits} from './weather-units';

// Match the 100 CSS-pixel ruler used by MapLibre ScaleControl. This limit is
// a ruler distance, not the width of the screen or the length of the route.
export const SATELLITE_SCALE_WIDTH = 100;
export const satelliteScaleMeters = (units: WeatherUnits) => units === 'us' ? 150 * 1609.344 : 200_000;

export function installSatelliteZoomLimit(map: LibreMap, units: WeatherUnits) {
  const originalMin = map.getMinZoom();
  const limit = satelliteScaleMeters(units);
  let updating = false, disposed = false;
  const update = () => {
    if (updating || disposed) return;
    const container = map.getContainer();
    if (!container.clientWidth || !container.clientHeight) return;
    const x = container.clientWidth / 2, y = container.clientHeight / 2;
    const left = map.unproject([x - SATELLITE_SCALE_WIDTH / 2, y]);
    const right = map.unproject([x + SATELLITE_SCALE_WIDTH / 2, y]);
    const distance = left.distanceTo(right);
    if (!Number.isFinite(distance) || distance <= 0) return;
    // A small margin lets the metric ruler actually round to 200 km at the
    // limit. Imperial ScaleControl uses its standard rounded labels (100 mi).
    const min = Math.max(originalMin, Math.min(map.getMaxZoom(), map.getZoom() + Math.log2(distance / (limit * 1.002))));
    if (Math.abs(map.getMinZoom() - min) < .002) return;
    updating = true;
    try {map.setMinZoom(min);} finally {updating = false;}
  };
  // Moving north/south and changing pitch change the ruler distance, so a
  // fixed zoom number would not enforce the same limit everywhere.
  map.on('move', update); map.on('resize', update); update();
  return () => {
    if (disposed) return;
    disposed = true; map.off('move', update); map.off('resize', update);
    map.setMinZoom(originalMin);
  };
}
