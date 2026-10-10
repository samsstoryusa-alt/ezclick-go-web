# Satellite observations

Loopback service 8798 serves the existing, explicitly recorded 2026-10-09 two-hour GOES sequence. It is not a live satellite feed or future forecast. Dates are shown on the observation timeline; route forecast cards continue using their usual weather API.

Caddy proxies /satellite-tiles/* and /satellite-data/* without stripping their prefixes. Both paths accept GET/HEAD only. Tile coordinates, zoom and timestamps are restricted; upstream hosts and products are fixed. Eight concurrent upstream requests and a bounded queue/cache protect the server. Missing data returns an error, never invented clouds.

Install server.cjs, satellite-tiles.cjs and frames.json in /opt/ezclick/satellite/app; use compose.yaml in its parent with a cache directory owned by uid 1000. Start with docker compose up -d. No secrets, accounts or tokens required by this service.

Checks: node --test deploy/satellite/check.cjs; /health; public frames catalog and an actual PNG tile. Cache is disposable. Stop only this container for rollback; preserve other weather services.
