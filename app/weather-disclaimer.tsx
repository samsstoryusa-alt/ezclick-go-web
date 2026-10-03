import './weather-disclaimer.css';
export default function WeatherDisclaimer(){
 return <main className="weather-legal-page">
  <header><a href="https://ezclickgo.com/"><img src="/media/ezclick-go-logo.png" width="2166" height="726" alt="EZCLICK GO"/></a><a href="https://weather.ezclickgo.com/">Back to weather map</a></header>
  <article><p className="legal-eyebrow">SERVICE INFORMATION</p><h1>Weather Information Disclaimer</h1><p className="legal-intro">Understand the limits of the weather information shown in EZCLICK GO.</p>
  <section><h2>Forecasts are estimates</h2><p>Weather information is provided for general information and trip planning. Forecasts and model estimates may differ from actual conditions at a particular location or time. They are not a guarantee of the weather you will encounter.</p></section>
  <section><h2>Data may be delayed or incomplete</h2><p>EZCLICK GO uses third-party weather and map data. Updates may be delayed, coverage may be limited, and information may contain errors or omissions. We do not guarantee the accuracy, completeness, timeliness, or uninterrupted availability of this information.</p></section>
  <section><h2>A clear map does not guarantee a clear road</h2><p>The absence of rain, snow, strong wind, or other hazards on the map does not establish that those conditions are absent. Some hazards and local conditions may not be represented. Animated transitions are visual interpolations between forecast frames, not additional observations.</p></section>
  <section><h2>Use additional sources for safety decisions</h2><p>Do not rely on EZCLICK GO as your sole source for driving or other safety-critical decisions. Check official weather alerts, road closures, travel restrictions, and current conditions. Follow instructions from local authorities and use your judgment about whether travel is safe.</p><p>The weather map is not an emergency warning service and does not certify that a road or route is safe or suitable for your vehicle.</p></section>
  <section><h2>Official information</h2><p>For U.S. weather forecasts and warnings, visit the <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">National Weather Service</a>. Consult the relevant state transportation department or 511 service for road conditions and restrictions.</p></section>
  <p className="legal-note">These limitations apply only to the extent permitted by applicable law and do not exclude any rights or responsibilities that cannot lawfully be excluded.</p>
  </article><footer><a href="https://weather.ezclickgo.com/">Return to the map</a><span>EZCLICK GO</span></footer>
 </main>;
}
