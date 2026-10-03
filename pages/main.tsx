import {createRoot} from 'react-dom/client';
import Page from '../app/page';
import WeatherMap from '../app/weather-map';
import WeatherDisclaimer from '../app/weather-disclaimer';
import '../app/fonts.css';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(window.location.pathname.replace(/\/$/, '') === '/terms' ? <WeatherDisclaimer/> : window.location.hostname === 'weather.ezclickgo.com' || window.location.pathname.replace(/\/$/, '').endsWith('/weather') || new URLSearchParams(window.location.search).get('view') === 'weather' ? <WeatherMap/> : <Page/>);
