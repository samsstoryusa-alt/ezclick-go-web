import type {WeatherLanguage} from './weather-translations';

export type SupportContext = {
  language: WeatherLanguage;
  quality: 'light' | 'balanced' | 'maximum';
  units: 'us' | 'metric';
  map: 'ready' | 'loading' | 'unavailable' | 'terrain-unavailable';
  routeActive: boolean;
};
export type SupportDiagnostics = SupportContext & {
  build: string;
  browser: string;
  system: string;
  device: string;
  viewport: string;
  online: boolean;
};
export type SupportReport = {
  requestId: string;
  description: string;
  replyTo: string;
  language: WeatherLanguage;
  diagnostics: SupportDiagnostics | null;
  aiConsent?: boolean;
};

// Intentionally accept only browser capabilities and coarse UI state. Never
// inspect storage, location, route points, microphone content, URLs or logs.
export function supportDiagnostics(context: SupportContext, device: {
  userAgent: string; platform: string; maxTouchPoints: number;
  width: number; height: number; online: boolean;
}, build: string): SupportDiagnostics {
  const ua = device.userAgent;
  const ipad = /iPad/.test(ua) || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
  const system = /iPhone|iPod/.test(ua) || ipad ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  const browserMatch = [/Edg(?:e|A|iOS)?\/(\d+)/, /(?:OPR|OPiOS)\/(\d+)/, /(?:Firefox|FxiOS)\/(\d+)/, /(?:Chrome|CriOS)\/(\d+)/, /Version\/(\d+).*Safari/].map(pattern => ua.match(pattern));
  const index = browserMatch.findIndex(Boolean);
  const browser = index < 0 ? 'Other' : ['Edge', 'Opera', 'Firefox', 'Chrome', 'Safari'][index] + ' ' + browserMatch[index]![1].slice(0, 3);
  const dimension = (value: number) => Math.max(10, Math.min(99999, Math.round(value)));
  return {
    build, browser, system,
    device: ipad || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet' : /Mobile|iPhone|iPod/.test(ua) ? 'phone' : 'desktop',
    viewport: `${dimension(device.width)}x${dimension(device.height)}`,
    language: context.language, quality: context.quality, units: context.units,
    online: device.online, map: context.map, routeActive: context.routeActive,
  };
}

export async function sendSupportReport(report: SupportReport, signal: AbortSignal): Promise<string> {
  const response = await fetch('/support-api/reports', {
    method: 'POST', credentials: 'omit', cache: 'no-store', signal,
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify(report),
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'rate_limited' : 'send_failed');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('ticketId' in result) || typeof result.ticketId !== 'string' || !/^EZ-[A-F0-9]{12}$/.test(result.ticketId)) throw new Error('send_failed');
  return result.ticketId;
}
