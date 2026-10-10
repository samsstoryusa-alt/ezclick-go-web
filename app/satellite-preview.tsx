import {useEffect, useRef, useState} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import {createSatelliteRenderer} from './satellite-renderer';
import {advanceSatelliteClock} from './satellite-clock';
import './satellite-preview.css';
type Frame = {time: number};

export default function SatellitePreview({map, ready}: {map: LibreMap | null; ready: boolean}) {
  const [frames, setFrames] = useState<Frame[]>([]), [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, retry] = useState(0);
  const [frequent, setFrequent] = useState(true), [restarting, setRestarting] = useState(false);
  const controls = useRef<{play: (value: boolean) => void; seek: (value: number) => void} | null>(null), slider = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!map || !ready) return;
    const abort = new AbortController(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed = false, raf = 0, last = 0, position = 0, hold = 0, target: number | null = null, isPlaying = false, buffering = true, shown = -1, hasFrequent = true, replaying = false;
    let renderer: ReturnType<typeof createSatelliteRenderer> | null = null, observations: Frame[] = [];
    setFrames([]); setLoading(true); setError(''); setPlaying(false);
    const region = () => {const p = map.getCenter().wrap(); hasFrequent = p.lng > -165 && p.lng < -25 && Math.abs(p.lat) < 65; setFrequent(hasFrequent);};
    const setBuffering = (value: boolean) => {if (buffering !== value) {buffering = value; setLoading(value);}};
    const publish = (value: number) => {
      if (!renderer || disposed) return false;
      try {
        if (!renderer.draw(value)) {setBuffering(true); return false;}
        position = value; setBuffering(false);
        if (slider.current && target === null) slider.current.value = String(Math.min(observations.length - 1, position));
        const replay = position > observations.length - 1; if (replay !== replaying) {replaying = replay; setRestarting(replay);}
        const a = Math.floor(position); if (a !== shown) {shown = a; setIndex(a);}
        return true;
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Satellite observations unavailable');
        isPlaying = false; target = null; buffering = false; setLoading(false); setPlaying(false); renderer.dispose(); renderer = null;
        return false;
      }
    };
    const schedule = () => {if (!disposed && renderer && !raf && !document.hidden && ((isPlaying && hasFrequent) || target !== null || buffering)) raf = requestAnimationFrame(tick);};
    const tick = (clock: number) => {
      raf = 0; if (disposed || document.hidden) return;
      const delta = last ? Math.min(64, clock - last) : 0; last = clock;
      const next = advanceSatelliteClock({position, target, hold}, delta, observations.length, isPlaying && hasFrequent, reduced);
      if (publish(next.position)) {
        target = next.target; hold = next.hold;
        if (slider.current && target === null) slider.current.value = String(Math.min(observations.length - 1, position));
      }
      schedule();
    };
    const play = (value: boolean) => {
      isPlaying = value; last = 0; target = null; hold = 0; cancelAnimationFrame(raf); raf = 0;
      setPlaying(value); schedule();
    };
    const visible = () => {last = 0; cancelAnimationFrame(raf); raf = 0; schedule();};
    const moved = () => {region(); last = 0; if (renderer) {publish(position); schedule();}};
    document.addEventListener('visibilitychange', visible); map.on('moveend', moved); region();
    void (async () => {
      try {
        const r = await fetch('/satellite-data/frames.json', {signal: abort.signal});
        if (!r.ok) throw Error('Observation times unavailable');
        const data = await r.json() as {frames: Frame[]}; if (disposed) return;
        if (data.frames.length < 2) throw Error('Observation sequence unavailable');
        observations = data.frames; renderer = createSatelliteRenderer(map, observations); setFrames(observations);
        controls.current = {play, seek: value => {play(false); target = Math.max(0, Math.min(observations.length - 1, value)); schedule();}};
        publish(0); play(!reduced);
      } catch (failure) {if (!disposed) {setError(failure instanceof Error ? failure.message : 'Satellite unavailable'); setLoading(false);}}
    })();
    return () => {
      disposed = true; abort.abort(); cancelAnimationFrame(raf); controls.current = null;
      document.removeEventListener('visibilitychange', visible); map.off('moveend', moved); renderer?.dispose();
    };
  }, [map, ready, attempt]);
  const date = frames[index]?.time;
  const time = (value: number) => new Date(value).toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit'});
  const dateLabel = date ? new Date(date).toLocaleDateString('en-US', {timeZone: 'America/New_York', month: 'short', day: 'numeric'}) : '';
  return <section className="radar-player radar-timeline satellite-timeline" aria-label="Satellite observations timeline">
    <div className="radar-player-heading"><strong>Clouds · recorded</strong><time>{date ? dateLabel + (frequent ? ' · ' + time(date) + ' EDT' : ' · daily mosaic') : 'Loading…'}</time></div>
    <div className="radar-player-row"><button type="button" disabled={!frames.length || !!error || !frequent} aria-label={playing ? 'Pause satellite animation' : 'Play satellite animation'} onClick={() => controls.current?.play(!playing)}>{playing ? 'Pause' : 'Play'}</button><input ref={slider} type="range" min={0} max={Math.max(1, frames.length - 1)} step=".001" defaultValue={0} disabled={!frames.length || !!error || !frequent} aria-label="Satellite observation time" aria-valuetext={date ? time(date) : 'Loading'} onChange={event => controls.current?.seek(Number(event.target.value))}/><button type="button" disabled={!frames.length || !!error || !frequent} onClick={() => controls.current?.seek(frames.length - 1)}>Last</button></div>
    {frames.length > 0 && frequent && <div className="radar-history-span"><span>{time(frames[0].time)}</span><span>Loop · 2 hours</span><span>{time(frames.at(-1)!.time)} EDT</span></div>}
    <p className="satellite-caption" role="status">{error || (loading ? 'Loading observations for this map area…' : restarting ? 'Replaying recorded observations…' : frequent ? 'GOES observations · forecast remains in route cards' : 'Daily observations here; 10-minute animation is available over the Americas.')} {error && <button type="button" onClick={() => retry(value => value + 1)}>Retry</button>}</p>
    <small>NASA GIBS · CIRA/NOAA · MODIS/VIIRS. Daily mosaic outside GOES coverage; gaps are missing observations, not clear skies.</small>
  </section>;
}
