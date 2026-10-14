# Test results - 14 October 2026

Environment: Windows, Node.js 22.17.0, installed Chromium via Playwright.

## Passed

- JavaScript syntax checks for the server and browser application.
- 5 automated test suites/subtests, zero failures: reference position mapping; unsupported model/settings and invalid references; recovered simulation lifecycle; upload signatures; protected durable end-to-end server workflow.
- Server workflow verified session protection, cross-origin mutation rejection, invalid upload rejection, persisted draft order, concurrent submission deduplication, pending/processing/completed states, restart recovery without duplicate jobs, video byte-range delivery, arbitrary asset-path rejection, and failed simulation.
- Browser workflow verified five-image upload, drag Image 5 into first position, keyboard-accessible reorder buttons, removal and renumbering, token insertion at the prompt cursor, invalid-reference feedback, draft refresh recovery, all four generation states, playable sample video metadata, history, and 390px mobile layout without horizontal overflow.
- Desktop and mobile screenshots were visually inspected.

## Deliverables and limits

Screenshots and the recorded browser demonstration are stored under ignored `test-results/`. Synthetic fixtures are tracked. Personal uploads and database files are ignored.

No live provider job was submitted, and no paid request was sent. Simulation demonstrates the app workflow using a bundled sample, not generated media based on the user's prompt. Provider authentication, multi-image support, actual API polling/download recovery, and paid billing have not been verified.

The host npm launcher failed before running commands because its npm-cli.js was missing. Direct Node commands passed. The in-app browser automation runtime failed to initialize; browser validation used the existing Playwright installation instead.
