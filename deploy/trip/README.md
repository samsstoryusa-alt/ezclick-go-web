# Route weather release

Private gateway: /opt/ezclick/trip/service.py, systemd ezclick-trip, loopback 8767.
Public API: Caddy /trip-api/ -> 8767. Never expose Valhalla's raw API.
POST /route: two bounded mainland coordinates and validated truck dimensions. Prefer highways (use_highways=1) and designated truck roads; prohibit mapped HGV=no roads (43200 threshold), exclude unpaved through-routes. Local access roads remain necessary near endpoints. The response omits duplicated maneuver geometry after deriving elapsedSeconds.
POST /weather: 2–24 validated sample coordinates/timestamps; UI caps at 16.
Bodies limited to 16 KB. Four concurrent requests, four NWS workers, 20 requests/minute per client. HTTP/1.1 responses. Logs contain endpoint and status only, never coordinates. Cache bounded to 1000 entries, hourly forecasts 10 minutes, point metadata 24 hours.

NOAA/NWS hourly forecasts are sampled at expected arrival. Route geometry and per-step estimated durations are provided by Valhalla; time inside each step interpolates by distance. Planned breaks are distributed proportionally along the route, not a legal hours-of-service scheduler. No live traffic, closures or gust data. Forecasts older than 24h and uncovered times become unknown, never clear/safe. Up to 16 checkpoints means hazards between checkpoints can be missed.

Colors are a product heuristic, not official warnings: high concern for thunder/freezing precipitation/ice/blizzard/hail or sustained wind >=35 mph; caution for rain/snow/sleet/fog/drizzle/wintry mix, wind >=20 mph or precipitation chance >=50%; low otherwise. Missing data gray. No road safety guarantee.

US routing image and ports: deploy/valhalla/compose-us.yaml. Dataset clipped from Geofabrik US PBF to -125,24,-66,50 using osmium complete_ways, excludes Alaska/Hawaii/territories. US build in /opt/ezclick/valhalla-us/data, port 8003. Colorado port 8002 preserved for rollback. Source download and build intermediates consume temporary disk space; do not infer final size from peak build space.

Frontend staging: /opt/ezclick/web/releases/weather-routes-20261003. Previous active release: releases/weather-disclaimer-20261003. Activate by changing current symlink and recreating only Caddy web container (bind mount resolves symlink). Preserve certificate volumes and weather collector. Roll back using previous symlink + previous Caddyfile.

Checks: python deploy/trip/test_service.py; node scripts/check-route-timing.mjs (including projected gradient alignment); changed route-weather TypeScript/ESLint; Vite build; existing forecast/wind/player checks; local mobile route + live forecast. Pre-existing route UI hooks trigger lint warnings/errors in road-route/weather-route; do not claim whole-repo lint clean.

Publication and all-US routing must be verified after graph build completes.

Pre-activation live checks: run /opt/ezclick/trip/probe_us.py after private port 8003 becomes ready. It checks Denver-Charlotte and Los Angeles-Seattle, geometry and monotonic segment timing. Then set ezclick-trip.service VALHALLA_URL to 8003 and restart the gateway. Validate Caddy before switching the current release.

The original full-US download was removed after the mainland extraction completed to free temporary space. Working us-mainland.osm.pbf is retained for the build. Do not count temporary sorting copies as the final map size.

Valhalla costing reference: https://valhalla.github.io/valhalla/api/route/api-reference/

2026-10-03 publication checkpoint: weather-routes-20261003 is active on weather.ezclickgo.com (index-CA8dmBHJ.js). Public /trip-api is active. While US processing runs, systemd uses port 8002 and ROUTING_COVERAGE=colorado. The UI displays Colorado preview and polls /health every 60 seconds. Once private US probes pass, change BOTH VALHALLA_URL to port 8003 and ROUTING_COVERAGE to contiguous-us, reload systemd and restart ezclick-trip. Repo unit already has these final values.

Public browser verification: desktop Denver/Boulder-area 32 mi/55 min, mobile Idaho Springs/Denver-area 36 mi/54 min; both built and returned all three current NWS forecasts. Mobile points fit the map above the forecast panel. Separate read-only API probe confirmed Denver-Boulder. Oversize body rejected with 413. Public weather map, wind and 24-hour forecast remained available.

US container runtime memory temporarily increased to 9 GiB (swap limit 18 GiB) during initial graph generation; restore 8 GiB / 16 GiB after startup. No OOM or restart observed. Base tiles completed at about 21:09 UTC; enhancement still in progress at this checkpoint. Final all-US readiness, routing checks and disk measurements remain outstanding.

Recovery checkpoint 21:31 UTC: initial build completed all 13,796 local tiles, then enhancement completed (961 seconds). Hierarchy sorting exhausted the 96-GiB disk and exited with SIGBUS, not OOM. Removed only failed old_nodes_to_new_nodes.bin.tmp, then verified installed Valhalla 3.9.0-53e00619f source (src/mjolnir/util.cc and hierarchybuilder.cc). ways.bin and way_nodes.bin are unused after build, so these 35 GiB of reproducible intermediates were removed. Base tiles had not been mutated by hierarchy yet (failure in SortSequences before FormTilesInNewLevel). Resumed with separate container ezclick-valhalla-us-resume using valhalla_build_tiles -c /custom_files/valhalla.json -s hierarchy -j 2. Original container restart disabled. Once resume exits 0, start production via compose with use_tiles_ignore_pbf=True, which loads completed tiles, builds extract and avoids rerunning initial stages. Do NOT start old default entrypoint before resume succeeds. Retain restrictions input bins until cleanup completes.

FINAL 2026-10-03: recovery completed successfully at 22:03:17 UTC, exit 0 including restrictions, validation and cleanup. Production compose /opt/ezclick/valhalla-us/compose.yaml uses use_tiles_ignore_pbf=True; 8 GiB RAM / 16 GiB memory+swap, private 8003. Original stopped build container renamed ezclick-valhalla-us-build-original for logs; completed resume container retained. The live gateway now uses 8003 and ROUTING_COVERAGE=contiguous-us. No frontend rebuild required; coverage badge updated automatically.

Validated: Denver-Charlotte 1,585 mi/27.0 driving hours, 20,487 geometry/timing entries; Los Angeles-Seattle 1,150 mi/20.7 h, 14,491 entries. All monotonic timing and duration checks passed. Actual Denver-Charlotte route weather returned 16/16 NWS checkpoints in 3.8 seconds, including higher-concern thunderstorm forecasts and caution rain near arrival. Public HTTPS /trip-api/route returned Denver-Charlotte in 0.86 seconds; /health reports contiguous-us. These travel times exclude live traffic, legal rest scheduling and breaks.

Measured server disk after startup: 96 GiB filesystem, about 58 GiB used and 39 GiB available. US data directory about 50 GiB including ~20 GiB individual routing tiles, their working tar archive and 11.18 GiB source PBF. All web releases together about 1.6 GiB. These figures include retained build source/working copies, not only rendered basemap. External map/weather tile providers remain dependencies.

Final frontend bundle index-Dm54s_H_.js adds measured desktop panel/controls margins when fitting a route, preventing endpoint pins underneath the UI. Mobile padding remains unchanged. Published by installing assets first and atomically replacing index.html; previous bundle retained for open tabs. Public browser cross-state test returned 1,578 mi/27h03 and 16/16 forecasts with a cyan-to-red-to-amber route.
