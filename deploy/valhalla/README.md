# Colorado Valhalla pilot

Implemented 2026-10-03. Frontend is LOCAL PREVIEW ONLY; public weather frontend and Caddy were not changed.

## Server
- Directory: /opt/ezclick/valhalla-colorado
- Container: ezclick-valhalla-colorado
- Official scripted image pinned in compose.yaml.
- Only 127.0.0.1:8002 is exposed. Access locally through the authorized SSH tunnel (local 8002 -> server 127.0.0.1:8002).
- Colorado Geofabrik extract. Graph built successfully, 599 tiles; status reports Valhalla 3.9.0-53e00619f.
- Data directory measured 1.5 GiB; idle container memory approximately 99 MiB after a route request. Limit 6 GiB, 2 CPUs.
- No live traffic data. No automated graph refresh configured. Review an explicit graph update procedure before production.

## Frontend
app/road-route.ts uses truck costing with actual height, width, total length, loaded weight, axle load/count and hazmat. Example values require user confirmation. Changing profile or points invalidates the route; stale requests are aborted. Only Colorado endpoints accepted. No car-route fallback.

Truck restrictions depend on mapped OpenStreetMap data, which may be incomplete. This pilot is not a guarantee of legal truck access. Route weather, stop/rest scheduling and live traffic are not integrated.

## Verification
- build:pages passed.
- Payload/validation checks passed (truck costing, metric conversions, invalid profile and outside coverage rejection).
- End-to-end mobile preview: set A/B near Idaho Springs/I-70; own server returned 26 mi / 43 min and route geometry displayed correctly.
- Public weather site still returned HTTP 200 after installation.

## Local preview
Use http://127.0.0.1:5174/mobile-preview.html with the SSH tunnel active. The UI endpoint is intentionally localhost for this pilot. Before publishing, add a protected same-origin server proxy with validation, rate limiting and coverage/error handling; do not expose raw Valhalla publicly.
