# Precipitation classification for the local weather preview

The `ezclick-precip-types` container on the OVH VPS reads NOAA MRMS PrecipFlag
GRIB2 files from the public NOAA S3 archive. It retains five hours of compact
1536x900 categorical masks, sampled every six minutes. A polling pass runs every
two minutes. Resources are limited to 2 CPUs and 2 GB RAM. Port 8766 is bound only
to 127.0.0.1 on the VPS, accessed through a private SSH tunnel on this computer.
Run `scripts/precip-types/start-tunnel.ps1` if the preview connection is closed.
No public production endpoint or TLS changes have been made. A deployed website
will need a same-origin `/weather-types` proxy to this service.

Source of truth: https://www.nssl.noaa.gov/projects/mrms/operational/tables.php

Actual PrecipFlag values: rain = 1, 6, 10, 91, 96; snow = 3; hail = 7.
Unused, missing, no-coverage and no-precipitation flags remain unclassified.
This differs from the current upstream RadrView palette's labels; do not copy
that mapping. Freezing rain and mixed precipitation are not resolved by this
product and must not be inferred from surface temperature or classified as rain.

Masks use EPSG:3857 with geographic corners (-130,52),(-60,52),(-60,22),(-130,22),
matching the NOAA radar image export exactly. Categorical resampling is nearest
neighbour. Browser rain recoloring is applied only where the classification says
rain. Snow is lavender. Only rain and snow are displayed; hail and unmatched echoes are hidden. Masks are
matched to each radar frame within four minutes, never reused beyond that limit.
No-precipitation or missing classification hides the radar echo.
Coverage is CONUS; echoes outside that classification domain are hidden.
The radar's own visibility/reflectivity carries the shape; masks do not create
new precipitation. Inter-frame crossfade is visual, not a new mixed category.

Verification: timestamp tolerance and color-unit checks, frontend type/lint/build,
live NOAA masks, and browser timeline checking. Current live masks may contain no
snow; this is not a reason to fabricate snow on the map.

## Fixed wind field and refresh

The weather:v2 image also runs winddata.py. It reads NOAA GFS 0.25-degree
10 m UGRD/VGRD via indexed S3 byte ranges, samples a fixed global 0.5-degree
grid (720 x 361), and stores hourly interleaved little-endian int16 vectors.
Scale is 0.1 m/s; 32767 means missing. /wind/frames gives run and valid times.
The browser converts to km/h, interpolates vectors spatially and between
adjacent hours, wraps the dateline, and refuses missing hours or runs older
than 18 hours. Particle spawn positions are decorative; flow is model-driven.
Camera height changes the view, not the wind altitude: all fields are at 10 m.
Point wind and particle wind share this exact source. Temperature and conditions
remain Open-Meteo model estimates, so they are not station observations.

The server checks GFS every 10 minutes and retains 18 hours; browser catalogs
refresh every 2 minutes and on tab return. Radar refreshes every 2 minutes,
retains the current display during downloads/failures, replaces frames on the
existing ImageSource, and displays latest-frame age (delayed after 20 minutes).
Rain/snow alone remain visible per product decision. No classification means
no displayed precipitation, never an invented rain classification.

Checks: node scripts/precip-types/check-wind.mjs and check.mjs, targeted lint,
TypeScript, production preview build, live GFS binary and browser playback.

Product scope: this page is the reusable weather map; route weather, stops,
and arrival-time forecasts belong in MyTrip. No extra icon tooltips planned.
The local preview still requires the private SSH tunnel. Public production
proxy/deployment and mobile layout acceptance are separate integration work.
