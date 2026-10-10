# Public voice beta — 2026-10-05

Prepared release: /opt/ezclick/web/releases/weather-voice-beta-20261005.
Activation: workspace work/voice-trial/activate-public.ps1 asks for key securely, sends over SSH stdin to activate-public.py. Never paste a key into chat or command arguments.
Backend: /opt/ezclick/voice-beta, Docker Compose, pinned node:22-alpine digest, non-root, read-only app, localhost:5196. Key in root-only voice.env; public usage ledger in data/usage.json. No audio/transcript logging. Conversation held in memory, expires after inactivity.
Public origin: https://weather.ezclickgo.com; exact Origin required on POST. /voice-api proxied with localhost Host; no cross-origin CORS. Frame same-origin only.
Browser identity: server-issued opaque HttpOnly Secure SameSite=Strict cookie, 30 days. Ledger survives container restart. Dialogue session separate per tab, scoped under browser identity.
Daily limits: 20 interpretations per browser, 1000 total. New York calendar reset. Clarifications count; each weather follow-up allowed once per accepted turn. Failed paid attempts count. This is a request allowance, NOT a dollar spending cap. Clearing cookies/new browsers can bypass individual allowance but not shared cap.
Tests: check-public.mjs (two clients, 21st blocked, global cap, persistence, reset, forged cookie, wrong origin); existing 16 backend and 3 conversation tests. All API responses mocked, no paid model-quality test in this verification.
Frontend beta flag: VITE_PUBLIC_VOICE_BETA=1 when building weather; normal weather homepage has the existing microphone drawer.
Rollback: restore Caddyfile.before-voice-beta and current symlink recorded in previous-voice-beta-release.txt, recreate only web. Stop voice container if disabling API.
Activated and publicly verified: status ready=true, dailyLimit=20, budgetScope=browser, assistantVersion=11. Browser checked homepage map, weather timeline, microphone drawer and embedded Start recording control. No real audio sent in this deployment check. Verify public /voice-api/status ready=true, budgetScope=browser, dailyLimit=20, assistantVersion=11, frontend asset hash, iframe/status/cookies after activation. Do not claim live voice recognition verified from status alone.
