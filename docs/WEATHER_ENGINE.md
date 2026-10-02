# EZCLICK Weather Engine v1

This branch establishes the weather architecture before the map UI is wired into production.

## Architecture

EZCLICK owns the map experience. Weather is delivered as independent overlays.

```
EZCLICK Map Core
  ├─ Radar / Rain          RadrView: MRMS + NEXRAD Level II
  ├─ Precipitation Type    RadrView: MRMS PrecipFlag
  ├─ Wind                  RadrView: NOAA GFS U/V grid + particle canvas
  ├─ Clouds                EZCLICK Weather service (NOAA source planned)
  ├─ Temperature           EZCLICK Weather service (NOAA source planned)
  ├─ Alerts                NWS alerts
  ├─ Route + ETA           EZCLICK
  └─ Labels / controls     EZCLICK
```

Each overlay is independently switchable. Failure of one weather source must never take down the basemap.

## Backend hostname

Production target:

```
https://weather.ezclickgo.com
```

Frontend override:

```
NEXT_PUBLIC_WEATHER_API_URL=https://weather.ezclickgo.com
```

## RadrView

Upstream: https://github.com/cwdaniel/RadrView

License: MIT. Keep the upstream license/copyright notices in any copied or modified source distribution.

We use the self-hosted backend pattern, not the public RadrView instance as a production dependency.

Primary endpoints used by EZCLICK:

- `GET /frames?source=composite`
- `GET /frames/latest?source=composite`
- `GET /tile/:timestamp/:z/:x/:y?palette=dark&source=composite`
- `GET /wind/grid`
- `WS /ws`

RadrView's hybrid radar path is useful for trucking:
- z2-z7: MRMS composite (~1 km)
- z8+: NEXRAD Level II (~250 m native)

## UI behavior

Default EZCLICK layer state:
- Radar / Rain: ON
- Wind: ON
- Alerts: ON
- Snow / Ice / Hail: OFF
- Clouds: OFF
- Temperature: OFF

The user's last layer combination is saved locally.

Examples:
- Rain + Wind
- Rain only
- Wind only
- Alerts + Rain
- Clean map (all weather overlays off)

## Animation

Follow the StormView-style frame strategy:
1. Keep the base map mounted.
2. Preload the next radar frame.
3. Crossfade front/back radar layers.
4. Move only weather layers when the time slider changes.
5. Keep wind on a separate canvas.
6. Never destroy/recreate the map while scrubbing time.

## Deployment boundary

The current GitHub Pages/Cloudflare frontend is not the RadrView processing server.

RadrView needs a Docker-capable server because it processes NOAA data, runs Redis/GDAL workers, stores radar frames and serves tiles/WebSockets.

Deploy that service separately and point `weather.ezclickgo.com` at it.

## Files added in this branch

- `app/weather-engine.ts` — typed client for the self-hosted weather API.
- `app/weather-layers.ts` — independent layer state + persistence.
- `app/weather-layer-panel.tsx` — compact EZCLICK layer switches.
- `docs/WEATHER_ENGINE.md` — architecture and deployment contract.
