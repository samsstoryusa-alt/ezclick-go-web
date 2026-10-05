// Keep localhost previews local; production weather uses its API-enabled host.
const local = typeof window === 'undefined' || ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const weatherUrl = local ? '/?view=weather' : 'https://weather.ezclickgo.com/';
export const tripEmbedUrl = local ? '/?view=weather&embed=trip' : 'https://weather.ezclickgo.com/?embed=trip';
const standalone = typeof document !== 'undefined' && document.documentElement.dataset.weatherStandalone === 'true';
export const platformUrl = standalone ? '/' : local ? '/version-a' : 'https://ezclickgo.com/';
