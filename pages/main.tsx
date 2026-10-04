import {createRoot} from 'react-dom/client';
import Page from '../app/page';
import VersionA from '../app/version-a';
import WeatherMap from '../app/weather-map';
import WeatherDisclaimer from '../app/weather-disclaimer';
import '../app/fonts.css';
import '../app/globals.css';

const path = window.location.pathname.replace(/\/$/, '');
const weather = window.location.hostname === 'weather.ezclickgo.com' || path.endsWith('/weather') || new URLSearchParams(window.location.search).get('view') === 'weather';
const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
if (weather && !local && window.location.hostname !== 'weather.ezclickgo.com') {
 window.location.replace('https://weather.ezclickgo.com/' + window.location.search);
} else {
 createRoot(document.getElementById('root')!).render(path === '/terms' ? <WeatherDisclaimer/> : weather ? <WeatherMap/> : path === '/experience' ? <Page/> : <VersionA/>);
}
