import {createRoot} from 'react-dom/client';
import './base.css';
import '../app/fonts.css';
import WeatherMap from '../app/weather-map';
import WeatherDisclaimer from '../app/weather-disclaimer';
const path=window.location.pathname.replace(/\/$/,'');
createRoot(document.getElementById('root')!).render(path==='/terms'?<WeatherDisclaimer homeUrl="/"/>:<WeatherMap/>);
