# Local voice integration

Prototype only. Not a public production endpoint or multi-user service.

- Run `pwsh -NoProfile -File deploy/voice-trial/start-private.ps1 -WithKey` and enter the API key in the masked prompt. No key file is written.
- Run the weather preview; open `/?voice-preview=1`. Vite proxies `/voice-api` to loopback port 5196. The voice service and weather preview must both remain running.
- Pull out the existing microphone, open the panel, record, stop and submit. Draft cities are looked up using the existing Photon forward-search provider. Select both matching places and explicitly enter a future local departure time (or choose leave now). Confirmation feeds the existing route builder and existing truck-profile checks.
- Common Russian/English numeric or word hours, today/tomorrow/day-after-tomorrow and ISO dates fill the date/time confirmation fields. Time-only corrections preserve the chosen date. Missing or ambiguous dates/times require clarification; no silent tomorrow/AM/PM guessing. Unsupported natural language remains a manual confirmation step.
- 20-second WAV limit is validated server-side; three submissions per minute; twenty submissions per process run. No automatic API retries. State exists only in server memory; one shared draft expires after fifteen minutes. This is unsuitable for concurrent users.
- Closing the panel cancels local recording and pending client requests. It cannot undo a provider request already sent.
- Before production: authenticated per-user sessions, persistent spend/rate enforcement, HTTPS deployment and server secret provisioning, per-user context/reset, automatic date/time-zone resolution with ambiguity checks, full localization and real-device end-to-end QA. Do not expose this local test server on the public network.

Checks: `node deploy/voice-trial/check.mjs`, `npm run check:weather`, `npm run build:weather` and `npm run build:pages`.

Assistant v2 (local preview): structured weather/help/control intents are separate from trip drafts. Route answers use only the current, complete response for the route, refuse snapshots older than ten minutes and report missing samples. City forecasts require explicit place selection; ambiguous times are confirmed in device timezone. The route-weather endpoint requires two samples, so city requests duplicate one location/time and display only one result. No extra OpenAI call generates the forecast answer.

Commands: show route, wind on/off, precipitation on/off, metric/US units, and clear route with explicit button confirmation. Help explains concern colors and precipitation probability. Departure comparisons and crosswind calculations are deliberately not implemented; these intents return a clear limitation. Replies are currently Russian; provider condition text can be English. Closing the outer voice panel keeps its contents mounted for the existing exit animation.

Additional check: `node scripts/check-voice-weather.mjs`. Backend restart with the masked key prompt is required after updating server.mjs; status includes assistantVersion: 2. The API key must never enter the frontend or a committed file.

Assistant v4: assistant-rules.json is validated and read before every recording is sent to OpenAI. Editing conversational rules no longer requires restarting the running v4 process or re-entering its key. Code/schema changes and full server restarts still require the existing masked startup procedure. No API key is persisted by this change.

Road-topic handling includes waiting out weather, truck parking, detours, road surface, closures, truck-specific safety, roadside services and arrival estimates. These classifications are not integrations: parking availability, alternative truck routing, hourly departure comparison, road closures and surface sensors are not connected. Unsupported topics explain the missing capability instead of providing invented locations or assurances. Arrival answers are planned whole-route estimates, not live tracking.

## Vehicle-aware voice context (2026-10-05)
Protocol v5 accepts bounded optional vehicle=truck|car in X-Voice-Route. Old clients remain valid; unknown values reject before provider calls. Current frontend always supplies selected vehicle, including before points exist. Model only classifies requests; vehicle selection remains the top-bar control, never an invented AI mutation.
Frontend discards results if transport, endpoints or departure changed during recognition. Vehicle-specific unsupported-feature explanations no longer refer to trucks in car mode. Transport change removes the prior assistant answer and aborts its in-flight weather request.
Activation: running v4 keeps its memory-only API key; do not extract that key or claim hot reload changes executable code. Restart via start-private.ps1 -WithKey using hidden user input. GET /status must show assistantVersion=5 and ready=true before live voice testing. Rules alone still hot-reload.
Checks: backend 13 mocked-provider tests, vehicle-specific answer tests, timing tests, check:weather, lint of changed voice files, both builds. No paid recognition requests made by this verification.
