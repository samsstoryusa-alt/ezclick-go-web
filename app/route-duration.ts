export function routeDurationMinutes(seconds:number){return Number.isFinite(seconds)?Math.max(0,Math.round(seconds/60)):0;}
export function formatRouteDuration(seconds:number){const minutes=routeDurationMinutes(seconds);return Math.floor(minutes/60)+'h '+minutes%60+'m';}
export function totalTripSeconds(drivingSeconds:number,breakMinutes:number){return drivingSeconds+breakMinutes*60;}
