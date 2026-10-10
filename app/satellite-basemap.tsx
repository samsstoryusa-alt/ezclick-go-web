import {useEffect} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import type {WeatherUnits} from './weather-units';
import {installSatelliteZoomLimit} from './satellite-zoom-limit';
export default function SatelliteBasemap({map, ready, units}: {map: LibreMap | null; ready: boolean; units: WeatherUnits}) {
  useEffect(() => {
    if (!map || !ready) return;
    return installSatelliteZoomLimit(map, units);
  }, [map, ready, units]);
  useEffect(() => {
    if (!map || !ready) return;
    const id = 'ezclick-satellite-base';
    const hidden = new Map<string, 'visible' | 'none' | undefined>();
    for (const layer of ['soft-vegetation', 'terrain-shading']) if (map.getLayer(layer)) {
      hidden.set(layer, map.getLayoutProperty(layer, 'visibility') as 'visible' | 'none' | undefined);
      map.setLayoutProperty(layer, 'visibility', 'none');
    }
    map.addSource(id, {type: 'raster', tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19,
      attribution: 'Satellite imagery © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noreferrer">Esri</a>, Vantor, Earthstar Geographics, GIS User Community'});
    const before = map.getStyle().layers?.find(layer => layer.type === 'line' || layer.type === 'symbol')?.id;
    map.addLayer({id, type: 'raster', source: id, paint: {'raster-fade-duration': 250, 'raster-opacity': 1}}, before);
    return () => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
      for (const [layer, visibility] of hidden) if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visibility ?? 'visible');
    };
  }, [map, ready]);
  return null;
}
