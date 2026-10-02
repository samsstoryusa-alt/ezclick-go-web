"use client";

export type WeatherLayerId =
  | "radar"
  | "precipType"
  | "wind"
  | "clouds"
  | "temperature"
  | "alerts";

export type WeatherLayerState = Record<WeatherLayerId, boolean>;

export const DEFAULT_WEATHER_LAYERS: WeatherLayerState = {
  radar: true,
  precipType: false,
  wind: true,
  clouds: false,
  temperature: false,
  alerts: true,
};

export const WEATHER_LAYER_META: Array<{
  id: WeatherLayerId;
  label: string;
  description: string;
  engine: string;
}> = [
  { id: "radar", label: "Radar / Rain", description: "MRMS + NEXRAD reflectivity", engine: "RadrView / NOAA" },
  { id: "precipType", label: "Snow / Ice / Hail", description: "MRMS precipitation classification", engine: "RadrView / NOAA" },
  { id: "wind", label: "Wind", description: "Animated 10 m wind flow", engine: "RadrView / GFS" },
  { id: "clouds", label: "Clouds", description: "Cloud cover overlay", engine: "EZCLICK Weather (planned NOAA layer)" },
  { id: "temperature", label: "Temperature", description: "Temperature field", engine: "EZCLICK Weather (planned NOAA layer)" },
  { id: "alerts", label: "Alerts", description: "Watches, warnings and advisories", engine: "NWS" },
];

const STORAGE_KEY = "ezclick-weather-layers-v1";

export function loadWeatherLayerState(): WeatherLayerState {
  if (typeof window === "undefined") return DEFAULT_WEATHER_LAYERS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WEATHER_LAYERS;
    return { ...DEFAULT_WEATHER_LAYERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WEATHER_LAYERS;
  }
}

export function saveWeatherLayerState(state: WeatherLayerState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Weather must continue working even when storage is unavailable.
  }
}
