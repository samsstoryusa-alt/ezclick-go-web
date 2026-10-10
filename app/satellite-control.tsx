import {useEffect, useRef, useState, type ReactNode} from 'react';
export type SatelliteMode = 'map' | 'clouds';
const options = [
  {value: 'map', title: 'Map', detail: 'Roads & weather forecast'},
  {value: 'clouds', title: 'Satellite + clouds', detail: 'Observed weather from space'},
] as const;

export default function SatelliteControl({mode, onChange, ready, children}: {mode: SatelliteMode; onChange: (mode: SatelliteMode) => void; ready: boolean; children?: ReactNode}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') {setOpen(false); button.current?.focus();} };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => {document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape);};
  }, [open]);
  return <div ref={root} className={`satellite-control ${open ? 'is-open' : ''}`}>
    <button ref={button} type="button" className="map-icon-button satellite-toggle" disabled={!ready} aria-label={`Map view: ${options.find(option => option.value === mode)?.title}. Change map view`} title="Map / Satellite + clouds" aria-expanded={open} aria-controls="satellite-options" aria-pressed={mode !== 'map'} onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-light" d="M9 24a6 6 0 0 1-1-12 8 8 0 0 1 15-2 7 7 0 0 1 1 14Z"/><path className="icon-mid" d="M7 22h18a5 5 0 0 1-4 2H9a6 6 0 0 1-5-3Z"/></svg>
      <span>Clouds</span>
    </button>
    <div id="satellite-options" className="satellite-options" inert={!open} aria-hidden={!open} role="group" aria-label="Map view">
      {options.map(option => <button type="button" key={option.value} aria-pressed={mode === option.value} onClick={() => {onChange(option.value); setOpen(false); button.current?.focus();}}><span className="satellite-choice-dot" aria-hidden="true"/><span><strong>{option.title}</strong><small>{option.detail}</small></span></button>)}
      {children}
    </div>
  </div>;
}
