# EZ Click Weather marketing site

The approved static landing lives in marketing/weather. The GitHub Pages build copies it to dist-pages/weather after building the general platform. It does not use the React SPA entry.

Public location: https://ezclickgo.com/weather/
Application: https://weather.ezclickgo.com/

The /weather path previously redirected to the application. The landing's Open app links retain that application destination. The weather app server and APIs are deployed separately and are not changed by this build.

Prepared from the approved local preview on October 10, 2026. The preview-only pages and QA files are excluded. Canonical and social-card URLs point to the confirmed public location. The landing permits indexing.

Plus is a planned $5 USD/month subscription. Checkout is not available. Voice allowances are undecided. 3D exploration and severe-weather alerts are explicitly planned additions. iPhone and Android native store apps are planned. No payment code is included.

To update: copy the reviewed static output into marketing/weather, preserving relative paths, then run npm run build:pages. Check /weather/ on desktop and mobile, media Range requests and app links. The existing GitHub Pages workflow deploys the main branch. Do not change the standalone weather release for a landing-only edit.
