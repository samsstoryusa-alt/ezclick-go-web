# UI motion requirements

- User preference: opening and closing panels, accordions, pickers and dialogs must feel smooth in both directions. Apply this to new UI and UI being changed.
- Use restrained height/clip, opacity and small translation transitions (typically 250–450 ms with ease-out). Keep content mounted through the exit transition; avoid state-dependent display:none or unmounting before exit completes.
- Preserve layout during asynchronous refresh. If previous data remains visible, clearly mark it as updating and prevent interaction until it is current.
- Keep hover hit areas stationary. Animate colors, shadows or inner content; do not swap gradients abruptly or shift the target away from the pointer.
- Respect prefers-reduced-motion: reduce by removing movement and using immediate or minimal fades.
- Verify open, close, Apply, repeated toggles and mobile overflow when changing expandable controls. Do not claim all existing UI was audited unless it was.

## Weather preview route

- For subsequent weather UI checks and user-facing previews, use Nashville, Tennessee to Jacksonville, Florida. Do not use Denver / Colorado as the routine test route.
- Preserve the user's existing route and map state. Do not reload their working tab just to verify a new build. Prepare any separate preview on the Nashville to Jacksonville route before handing it over.

## Standalone weather launch

- Current launch scope is the standalone route-weather product, not all EZCLICK GO modules. Read docs/weather-launch/launch-plan.html for the product brief, evidence, role assignments and backlog.
- Primary users: drivers and owner-operators. Dispatchers are secondary. Starting budget: USD 1,000–2,000, replacing the earlier USD 3,000. USD 3.99/month is a hypothesis, not an approved live offer.
- Target web, iOS/iPadOS, Android, Windows and macOS in phases. No committed release date. Preserve the general EZCLICK GO site during separation.
- Standalone weather build is implemented. Next engineering task: inspect and preserve route/departure state across reloads. Audit records are not proof of current production health. Do not treat budget planning as authorization to spend, publish or message external parties.

## ECC workflow for standalone weather

- Installed on 2026-10-04 from affaan-m/ECC commit ef648e01899ba3e8dc6371642deaaf64b4477775: product-lens, frontend-patterns, verification-loop, market-research. Skills are in C:/Users/samss/.codex/skills. They are on-demand guidance, not persistent workers or services embedded in the weather app.
- Use product-lens for product scope and prioritization; frontend-patterns for React UI/state work; verification-loop for significant code changes; market-research for competitors, positioning and pricing evidence. Read the relevant SKILL.md before applying it. Do not repeat intake questions already answered in the launch brief.
- Work sequentially: concrete objective and acceptance criteria, scoped implementation, review and relevant checks, concise result with limitations. Marketing research runs when the business task calls for it, not on every code change. Agent delegation requires user authorization; skill installation alone does not launch workers.
- Adapt example commands to Windows PowerShell and actual package scripts. Standalone build: npm.cmd run build:weather; boundary check: node scripts/check-weather-build.mjs. Select existing route, weather-symbol, wind and backend tests according to the change. Use build:pages when shared code changes affect the general site. There is no generic test script: do not claim coverage without measurement.
- Report pre-existing lint/type failures separately from regressions. Review the current diff without overwriting unrelated user edits. Security checks must not print secret values; report paths and redacted findings only. A keyword scan is not a full security audit.
- First workflow trial: assess current route/departure persistence, preserve an explicitly chosen trip across refresh, use Nashville to Jacksonville as the default only when no saved trip exists, and refresh forecast data rather than presenting stale forecasts as current. Validate desktop and mobile in a separate preview. This is the next task, not a claim of completed implementation.
## Approval before UI changes

- Before making a new design or interaction change, describe the concrete proposed appearance and behavior, then wait for the user's explicit approval. Approval applies only to that described scope; do not add other UI changes under it.
- An explicitly requested rollback is authorized and does not require another approval.
