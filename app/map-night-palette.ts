import type {Map as LibreMap} from 'maplibre-gl';

// Apply the permanent night palette without changing sources or terrain.
export function applyMapPalette(map: LibreMap) {
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

