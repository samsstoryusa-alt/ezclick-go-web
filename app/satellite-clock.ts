export type SatelliteClock = {position: number; target: number | null; hold: number};

/** Commit this proposed time only when its observation tiles can be displayed. */
export function advanceSatelliteClock(state: SatelliteClock, elapsed: number, frameCount: number, playing: boolean, reduced: boolean): SatelliteClock {
  const delta = Math.max(0, Math.min(64, elapsed)), last = frameCount - 1;
  if (frameCount < 2) return {...state, position: 0};
  if (state.target !== null) {
    const target = Math.max(0, Math.min(last, state.target));
    let position = reduced ? target : Math.min(last, state.position) + (target - Math.min(last, state.position)) * (1 - Math.exp(-delta / 70));
    if (Math.abs(target - position) < .005) position = target;
    return {position, target: position === target ? null : target, hold: 0};
  }
  if (!playing) return state;
  if (state.position < last) return {...state, position: Math.min(last, state.position + delta / 1400), hold: 0};
  if (state.hold < 800) return {...state, hold: Math.min(800, state.hold + delta)};
  // A short dissolve restarts the recorded loop without running weather backward.
  const position = state.position + delta / 650;
  return position >= frameCount ? {position: 0, target: null, hold: 0} : {...state, position};
}
