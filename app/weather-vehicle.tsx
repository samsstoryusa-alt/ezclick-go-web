"use client";
import {useSyncExternalStore} from 'react';
import type {VehicleType} from './road-route';
import {useWeatherLanguage} from './weather-language';
import './weather-vehicle.css';
import vehicleArtwork from './assets/vehicle-icons-approved.png';
const KEY='ezclick-weather-vehicle',EVENT='weather-vehicle-change';
let choice:VehicleType|null=null;
function snapshot():VehicleType{if(choice)return choice;try{return localStorage.getItem(KEY)==='car'?'car':'truck';}catch{return 'truck';}}
function subscribe(update:()=>void){const storage=(e:StorageEvent)=>{if(e.key===KEY||e.key===null){choice=null;update();}};window.addEventListener(EVENT,update);window.addEventListener('storage',storage);return()=>{window.removeEventListener(EVENT,update);window.removeEventListener('storage',storage);};}
export function useWeatherVehicle(){const vehicle=useSyncExternalStore(subscribe,snapshot,()=> 'truck' as VehicleType);return {vehicle,setVehicle:(value:VehicleType)=>{choice=value;try{localStorage.setItem(KEY,value);}catch{}window.dispatchEvent(new Event(EVENT));}};}
const labels:Record<string,[string,string,string]>={en:['My vehicle','Truck','Car'],ru:['Мой транспорт','Трак','Легковая машина'],uk:['Мій транспорт','Вантажівка','Легкове авто'],es:['Mi vehículo','Camión','Coche'],fr:['Mon véhicule','Camion','Voiture'],de:['Mein Fahrzeug','Lkw','Pkw'],pt:['Meu veículo','Caminhão','Carro'],ro:['Vehiculul meu','Camion','Autoturism'],zh:['我的车辆','卡车','轿车'],hi:['मेरा वाहन','ट्रक','कार'],pa:['ਮੇਰਾ ਵਾਹਨ','ਟਰੱਕ','ਕਾਰ'],ar:['مركبتي','شاحنة','سيارة']};
function VehicleIcon({truck}:{truck:boolean}){return <svg viewBox={truck?'75 30 1065 665':'1260 205 805 480'} aria-hidden="true" focusable="false"><image href={vehicleArtwork} width="2172" height="724"/></svg>;}
export default function WeatherVehicleMenu(){const {vehicle,setVehicle}=useWeatherVehicle();const {language}=useWeatherLanguage();const text=labels[language]??labels.en;return <section className="weather-vehicle" role="group" aria-label={text[0]}>{(['truck','car'] as const).map((value,i)=><button key={value} type="button" aria-label={text[i+1]} title={text[i+1]} aria-pressed={vehicle===value} onClick={()=>setVehicle(value)}><VehicleIcon truck={value==='truck'}/></button>)}</section>;}
