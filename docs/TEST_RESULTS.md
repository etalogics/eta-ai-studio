# Test results - 14 October 2026

Environment: Windows, Node.js 22.17.0, installed Chromium via Playwright.

## Passed

- JavaScript syntax checks for the server and browser application.
- Production Next.js 16.4 build, TypeScript 6 check, and ESLint 10 check passed.
- 6 automated test suites/subtests, zero failures: reference position mapping; unsupported model/settings and invalid references; recovered simulation lifecycle; upload signatures; server-only credential configuration; protected durable end-to-end server workflow.
- Server workflow verified session protection, cross-origin mutation rejection, invalid upload rejection, persisted draft order, concurrent submission deduplication, pending/processing/completed states, restart recovery without duplicate jobs, video byte-range delivery, arbitrary asset-path rejection, and failed simulation.
- Browser workflow against the production Next.js app verified five-image upload, dropped-file append without replacing existing images, drag Image 5 into first position, Enter-key reordering, removal and renumbering, token insertion at the prompt cursor, invalid-reference feedback, draft refresh recovery, all four generation states, decoded playable 10-second sample video, history, server configuration status, and 390px mobile layout without horizontal overflow.
- Desktop and mobile screenshots were visually inspected.

## Deliverables and limits

Shared screenshots are tracked under `docs/screenshots/`; `docs/demo.mp4` contains the recorded full workflow and a results/pending-items end card. QA intermediates remain under ignored `test-results/`. Synthetic fixtures are tracked. Personal uploads and database files are ignored.

No live generation job was submitted, and no paid request was sent. Simulation demonstrates the app workflow using a bundled sample. A read-only Higgsfield status check accepted the locally configured credential. Actual model access, generated-output retrieval, signed media hosts, and paid billing remain unverified.

The host npm launcher failed initially because its npm-cli.js lookup was broken. The installed npm CLI was invoked directly for dependency setup; build, lint, typecheck, and tests ran through local Node entry points. ESLint/TypeScript peer incompatibilities and a vulnerable development dependency chain were removed; the final installation reported zero known vulnerabilities. The in-app browser automation runtime failed to initialize; browser validation used the existing Playwright installation instead.

A production-browser startup race was found and fixed: generation stays disabled and upload is guarded while the saved workspace is loading. The corrected full browser flow passed.

## Higgsfield adapter update

- Full suite expanded to 12 passing tests, including payload mapping, unsupported multi-image rejection, API/storage header separation, trusted URL validation, submission idempotency, request identity checks, credential fingerprint invalidation, saved worker identity, and no automatic retry of uncertain submissions.
- The worker uses database leases and streams real outputs to temporary files before publication. Its generation/polling tests use mocks; no real paid request ran.
- Browser QA passed in an isolated data directory, including the live-model approval gate, disabled image-derived aspect ratio, and unchecked per-job paid consent. The user's main draft was preserved during this QA run.
- The main app reports credentials configured, authentication accepted, and live generation disabled. No key or fingerprint is returned to the browser.
- The user explicitly chose to keep live generation disabled with no charges. No paid smoke test was run.
