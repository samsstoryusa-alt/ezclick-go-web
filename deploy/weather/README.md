# Weather VPS deployment

Target: https://weather.ezclickgo.com (Cloudflare proxy).

Frontend: build with `npm run build:pages`, then archive dist-pages contents.
Server root: /opt/ezclick/web. Release directories live in releases/; current
is a symlink to the active immutable release. Caddy mounts current read-only.
After changing that symlink recreate the web container to remount the release.

Caddy serves HTTPS and proxies /weather-types/* to 127.0.0.1:8766, stripping
the prefix. The existing NOAA collector remains private and independently
managed. This removes the browser's dependency on the workstation SSH tunnel.
Localhost development still uses that tunnel. Other map/weather providers are
requested directly by the browser as before.

Run from /opt/ezclick/web: `sudo docker compose up -d`.
Persist caddy_data and caddy_config for certificate renewal. Never delete these
volumes during a release. Pin the Caddy image to its tested digest after pull.
Rollback: point current at the preceding release and recreate only web.

Validation: HTTPS root, /weather-types/frames, /weather-types/wind/frames,
then an actual mask and compressed wind binary; browser map, playback and units.
Expected website route: / (weather subdomain) or /?view=weather.

Pre-deployment checks: precipitation, wind and player tests; changed-file ESLint;
targeted TypeScript; build:pages. The old, unchanged weather-layer-panel.tsx
scaffold has a pre-existing react-hooks/set-state-in-effect lint error; it is
not used by the new weather map.
Deployment verified 2026-10-03 (America/New_York): Cloudflare A record weather
points to 40.160.37.103 with proxy enabled. Let's Encrypt certificate issued;
HTTPS root and both data catalogs/assets return 200. Website and data no longer
require the workstation tunnel. Internal diagnostics are bound to 127.0.0.1:8088.

24-hour forecast release:
- NOAA GFS instantaneous PRATE, CRAIN and CSNOW (not accumulated rainfall).
- Forecast collector atomically publishes 26 consecutive hourly frames from one
  model run, together with matching 10 m U/V wind. Browser interpolates exactly
  now through +24h; missing/stale model runs are rejected.
- Forecast images cover [-130,22,-60,52], 1024x600 Web Mercator. Wind is global.
  Rain/snow only; ice pellets/freezing rain are not distinguished on this layer.
- A model estimate also applies at Now. This replaces radar history in the UI.
- Run check-forecast.mjs and check-forecast-live.mjs in addition to player/wind checks.
- Backend image ezclick-weather:v3; previous stopped container
  ezclick-precip-types-v2-backup is retained for rollback, with the same data volume.
- Frontend release releases/weather-forecast-20261003. Existing static media was
  copied from the preceding release; index.html/assets were replaced by the build.

Precipitation rendering v2: bilinear category coverage replaces nearest-cell binary
clipping. Color/alpha are blurred together in premultiplied form, then restored
to straight RGBA. The 1.6px presentation filter softens native 0.25-degree cells;
it does not increase meteorological resolution. New /forecast/v2/ URLs prevent
old immutable images from being reused. Backend v4; old v3 container retained.
Rendering checks: python3 scripts/precip-types/check-forecast-render.py (GDAL image).
