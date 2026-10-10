"use client";
import {useId} from 'react';
import {useWeatherLanguage} from './weather-language';
import {setWeatherQuality,useWeatherQuality} from './weather-quality';
const modes=['light','balanced','maximum'] as const;
const labels=['Light','Balanced','Maximum'] as const;
export default function WeatherQualityMenu(){
 const quality=useWeatherQuality(),{t,dir}=useWeatherLanguage(),index=modes.indexOf(quality);
 const descriptionId=useId(),description=t('Visual effects only. Forecast accuracy stays the same.');
 return <fieldset className="weather-quality" dir={dir} title={description}>
  <legend>{t('Graphics quality')}</legend>
  <div className="weather-quality-control" dir="ltr">
   <input className="weather-quality-slider" dir="ltr" aria-label={t('Graphics quality')} aria-valuetext={t(labels[index])} aria-describedby={descriptionId} type="range" min={0} max={2} step={1} value={index} onChange={event=>setWeatherQuality(modes[Number(event.target.value)])}/>
   <span className="weather-quality-motion-track" aria-hidden="true"><span className="weather-quality-motion-thumb" style={{left:`${index*50}%`}}/></span>
   <div className="weather-quality-stops" aria-hidden="true"><i/><i/><i/></div>
  </div>
  <strong className="weather-quality-current">{t(labels[index])}</strong>
  <small id={descriptionId} className="weather-quality-description">{description}</small>
 </fieldset>;
}
