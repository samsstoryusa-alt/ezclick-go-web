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