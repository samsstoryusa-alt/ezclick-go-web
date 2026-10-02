export type RadarLayer = "reflectivity" | "precip-type" | "velocity";

export type WeatherFrame = {
  timestamp: string;
  epochMs: number;
};

export type WeatherFramesResponse = {
  source: string;
  frames: WeatherFrame[];
  latest?: string;
  count?: number;
};

export type LatestWeatherFrame = {
  timestamp: string;
  epochMs: number;
  source: string;
  age?: number;
};

const FALLBACK_API = "https://weather.ezclickgo.com";

export function weatherApiBase() {
  return (process.env.NEXT_PUBLIC_WEATHER_API_URL || FALLBACK_API).replace(/\/+$/, "");
}

export function radarTileUrl(options: {
  timestamp: string;
  source?: string;
  palette?: string;
  layer?: RadarLayer;
}) {
  const base = weatherApiBase();
  const source = options.source || "composite";
  const palette = options.palette || (options.layer === "velocity" ? "velocity" : options.layer === "precip-type" ? "precip-type" : "dark");
  const layer = options.layer || "reflectivity";

  const qs = new URLSearchParams({
    palette,
    source,
  });

  if (layer !== "reflectivity" && layer !== "precip-type") {
    qs.set("layer", layer);
  }

  return `${base}/tile/${options.timestamp}/{z}/{x}/{y}?${qs.toString()}`;
}

export async function getWeatherFrames(source = "composite", limit = 288) {
  const res = await fetch(
    `${weatherApiBase()}/frames?source=${encodeURIComponent(source)}&limit=${limit}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Weather frames request failed: ${res.status}`);
  return (await res.json()) as WeatherFramesResponse;
}

export async function getLatestWeatherFrame(source = "composite") {
  const res = await fetch(
    `${weatherApiBase()}/frames/latest?source=${encodeURIComponent(source)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Latest weather frame request failed: ${res.status}`);
  return (await res.json()) as LatestWeatherFrame;
}

export async function getWindGrid() {
  const res = await fetch(`${weatherApiBase()}/wind/grid`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Wind grid request failed: ${res.status}`);
  return res.json();
}

export function weatherWebSocketUrl() {
  const url = new URL(weatherApiBase());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  return url.toString();
}
