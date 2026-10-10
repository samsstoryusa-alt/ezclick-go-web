# Weather support inbox

The standalone weather menu opens a native modal with a description, an optional
reply email and optional, previewable technical details. The map and route remain
mounted. Closing the dialog keeps the draft only in memory; reloading clears it.
The frontend sends a POST to `/support-api/reports`. A receipt means that SQLite
committed the report; it is not a promise of SMTP delivery or a human reply.

The Python 3.12 standard-library service binds only `127.0.0.1:8770`. Install the
systemd unit and proxy snippet supplied here; do not expose that port publicly.
It uses a private DynamicUser state directory, limited memory/threads, no packages
and no browser credentials. Google Workspace SMTP relay must allow **only** the
server IPv4 `40.160.37.103`, registered Workspace users and mandatory TLS. The
service explicitly binds that source address so dual-stack DNS cannot use IPv6.
Envelope sender: `dispatch@ezclickgo.com`; fixed recipient: `support@ezclickgo.com`.
No request can choose another recipient. The optional user address is Reply-To.

Google relay configuration grants sending access to this host and requires the
owner's action-time approval in Google Admin before it is saved. It does not
grant inbox-reading access. Deploy only after configuration and delivery testing.

Reports have random IDs, stable idempotency keys and stable email Message-IDs.
SMTP failures are retried after 1, 2, 4, 8, 16, 32 and then 60 minutes. A crash
after Google accepts a message but before the sent status is committed can result
in a duplicate email with the same ticket/Message-ID (at-least-once delivery).
The queue survives restarts; no browser read/list endpoint is exposed.

Validation: 32 KiB body, 10–6000 description characters, exact diagnostic schema,
strict reply-email validation, same-origin JSON only. Technical data excludes
locations, routes, audio, raw URLs, full user agents, cookies and logs. A keyed
network hash is retained for 24h for rate limiting; raw addresses are not stored.
Reports are deleted after 30 days, with secure-delete and WAL truncation. Email
copies remain in the support mailbox. This feature does not set a Gmail retention
policy. Operational logs contain only ticket IDs and error classes.

Rate limits: 20 reports/transport peer/hour, 40 global/hour, 200 global/day.
Caddy overwrites the peer header; forwarded client headers are not trusted.
Cloudflare users at one POP therefore share the per-peer allowance. This is
conservative for the current private beta; review measured usage before widening
the beta, and add verified client IP handling/CAPTCHA if abuse warrants it.

Local tests (no outbound email):

```text
python -m unittest discover -s deploy/support -p "test_*.py" -v
node scripts/check-weather-support.mjs
npm run check:weather
npm run build:weather
node scripts/check-weather-build.mjs
npm run build:pages
```

Local UI: set SUPPORT_DELIVERY=off, SUPPORT_DATA_DIR to a workspace-only folder,
SUPPORT_ORIGINS to the exact Vite preview origin. Start `python service.py` and
Vite preview. The weather Vite config proxies `/support-api` to 127.0.0.1:8770.
VITE_WEATHER_BUILD_ID defaults to the weather build UTC timestamp.

Operations: `systemctl status ezclick-support` and
`journalctl -u ezclick-support --since today` show delivery state without contents.
Inspect queue counts with privileged SQLite access to
`/var/lib/ezclick-support/support.sqlite3`. Keep the state directory through
upgrades/rollback; never put it in a release archive, Git, logs or a public folder.
The service has no automatic external monitor; include queue age/count in the
existing server monitoring before a wider launch.

## Optional AI draft review

The separate, unchecked form choice records `aiConsent=true`. Missing or false
consent is stored in the legacy shape so pending idempotent retries still work.
Legacy reports and reports without consent never enter the AI queue. Intake and
SMTP stay independent of the worker. AI failure does not change the receipt.

With `SUPPORT_AI=on`, a separate thread prepares private unverified drafts using
the existing OpenAI account, fixed `gpt-4.1-mini`, `store:false`, strict JSON,
40-second transport timeout and 1,200 output tokens. Input includes a redacted
description, language and shared operating-system family, plus up to eight
redacted summaries of previously consented reports for duplicate suggestions.
Reply-To, network hashes and all other diagnostic fields are excluded. The text
filter covers email/URL/token/coordinate patterns, not every possible personal
detail; never describe this input as anonymous. The worker has no tools and
cannot browse, send replies, run code or alter issues. All report/model text is
untrusted. An operator must verify proposed priority and reproduction details.

The persisted cap is 20 API attempts per UTC calendar day, including failures;
overflow waits for the next day. Exact normalized description/language/platform
duplicates reuse a draft with no API call; matching fingerprints group reports.
Semantic matches are suggestions restricted to supplied existing ticket IDs.
Leases prevent simultaneous handling of one report; after five failed/crashed
attempts it becomes manual review. SQLite FK cascades remove drafts/queue rows
with the 30-day source report, and clear references to expired duplicate IDs.

Production reads `openai_api_key` from systemd LoadCredential, backed by
`/etc/ezclick-support/openai-api-key` (root-owned, 0600). Provision it securely
from the existing voice provider configuration without printing the value.
Rotate this credential alongside the voice API key and restart ezclick-support.
`OPENAI_API_KEY` is an optional local-test override; never commit credentials.

Private operator overview (no public read/list API):

```text
sudo python3 /opt/ezclick/support/current/triage.py --db /var/lib/ezclick-support/support.sqlite3
```

The JSON contains draft state, fingerprint groups and suggested duplicates.
Draft priority is proposed, not confirmed. A null state means manual intake
without AI consent. `--run-one` is an explicit paid processing action and needs
the credential; normal production work uses the service thread. A service restart
does not reset the daily cap or duplicate groups. Disabling `SUPPORT_AI` pauses
AI processing while receipt and email continue.
