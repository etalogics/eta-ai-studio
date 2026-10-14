# Eta Logics AI Creator Studio

A working local first milestone: ordered image references, prompt mentions, image-to-video settings, simulated generation states, playable/downloadable sample output, and persistent generation history.

**Simulation is the default; live generation is disabled pending approval.** A Higgsfield/Kling adapter and durable worker are implemented. Server-side authentication has passed a read-only check, but no paid generation has run. Simulation output is a bundled animation matching the chosen 5- or 10-second duration and aspect ratio; it does not depict the uploaded reference or execute the prompt. See `docs/INTEGRATION.md` before enabling live mode.

## Laptop setup: follow these steps in order

These commands are for Windows PowerShell. Install Git and Node.js **22.17.0 or newer** with npm before starting, then reopen PowerShell. You need internet access, company repository access, and permission to install dependencies. Python, a GPU, and hosting are not required. Keep the laptop awake during setup.

### 1. Verify the installed tools

```powershell
node --version
npm --version
git --version
```

### 2. Download the project

Run from the folder where you want to keep the project. Sign in to GitHub through its credential manager if prompted; never place a token in the clone URL.

```powershell
git clone https://github.com/etalogics/eta-ai-studio.git
cd eta-ai-studio
```

### 3. Create local configuration

Only copy the template on the first setup. This command preserves an existing configuration.

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Keep these settings for the approved, no-charge test:

```dotenv
PORT=4310
STUDIO_DATA_DIR=./data
STUDIO_LIVE_ENABLED=false
STUDIO_APPROVED_MODEL=
```

Simulation works without API credentials. If credentials are supplied securely, enter them only in the local ignored .env file. Never send that file to GitHub. Adding a key does not authorize paid generation. See docs/INTEGRATION.md for live integration requirements.

### 4. Install dependencies

```powershell
npm ci
```

### 5. Build and verify

Run each command separately; resolve a failure before continuing. Build before typecheck and tests because they use generated framework files and the production server.

```powershell
npm run lint
npm run build
npm run typecheck
npm test
```

### 6. Start the app

```powershell
npm start
```

Keep this terminal open and visit **http://127.0.0.1:4310**. Follow the complete flow below using Simulation. Press Ctrl+C in the terminal to stop. All seven supplied references can be uploaded locally; personal images are not included in the repository. Live provider input limits differ from simulation.

### 7. Start again after restarting the laptop

Open PowerShell, enter your actual installation folder, then start:

```powershell
cd C:\path\to\eta-ai-studio
npm start
```

Alternatively, double-click start-studio.cmd in the project folder on Windows. Open http://127.0.0.1:4310 again. Dependency installation and rebuilding are unnecessary on every reboot. Keep .env and data/ to retain configuration, references, drafts, and history.

### 8. Install future updates

Stop the app first and back up the complete data/ folder and .env locally. Then run:

```powershell
git pull --ff-only
npm ci
npm run lint
npm run build
npm run typecheck
npm test
npm start
```

If Git reports divergent history after a repository history update, preserve .env and data/, clone a fresh checkout into a different folder, then restore those local files while both apps are stopped. Do not use a destructive reset to repair a checkout containing unsaved work.

### Troubleshooting

- **node/npm/git not recognized:** install the missing tool and reopen PowerShell. Check Node's version against the requirement above.
- **PowerShell blocks npm.ps1:** use npm.cmd in place of npm, for example npm.cmd ci. Do not change system execution policy for this.
- **Missing npm-cli.js:** repair the Node/npm installation. If installed in the default Windows location, the bundled CLI can also run commands, for example: node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" ci.
- **Production build missing:** run npm ci and npm run build before npm start.
- **Port 4310 already in use:** stop the previous app terminal, or change PORT in .env to 4311, restart, and visit http://127.0.0.1:4311.
- **Cannot open localhost:** confirm npm start is still running, check terminal errors, and use the configured port on the same laptop. Remote setup requires an available AnyDesk session; a GitHub push does not install the app on another laptop.
- **Live generation disabled:** this is the current approved configuration. Do not enable it to troubleshoot simulation. No paid requests are needed for the local flow test.

For development use npm run dev. Production uses the project's custom server through npm start; do not replace it with an unconfigured next start. macOS/Linux use the same npm commands, with cp .env.example .env for a fresh configuration and the appropriate local project path.

## Walk through the complete flow

1. Select/drop one or more PNG, JPEG, or WebP references. Add additional images without replacing existing ones. Maximum 8 images, 10 MB each.
2. Drag cards to reorder or use the labelled left/right buttons with the keyboard. The first image is marked as the start frame. The ordered stable asset IDs are persisted in the draft and each job.
3. Write a prompt. Click `@image1` chips to insert tokens at the current cursor. Mentions refer to **current gallery positions**, so reordering intentionally changes their target; the UI warns you. Both `@image1` and `@image 1` are accepted. Missing numbers block submission.
4. Choose the simulation model, duration, and aspect ratio. Press Generate preview.
5. Observe pending, processing, and completed. Play/download the explicitly labelled sample clip. Use Simulation test options to exercise a failed job.
6. Open History to see saved prompts, settings, reference order, status, and sample downloads. Use settings restores inputs without submitting another job.
7. Refresh or restart the app: drafts and history persist. A previously pending simulation recovers its state from its saved timestamp. This is a deterministic simulation, not a live background worker.

## Storage and safeguards

`data/studio.sqlite` contains assets, jobs, and the saved draft. `data/references/` contains originals stored under generated IDs. Versioned SQL migrations under `db/migrations/` are applied on first API access using `PRAGMA user_version` and a transaction. Existing version-1 prototype data remains compatible. Synthetic output fixtures are tracked in `fixtures/`.

The server binds to loopback. Host validation, an HttpOnly SameSite session cookie, Origin validation, and a CSRF header protect API mutations. Images are served by database asset ID, never arbitrary paths. Upload byte signatures and size limits are checked server-side. Model choices, settings, assets, and mentions are checked again on submission. Unique submission tokens deduplicate repeated requests. Secrets, runtime data, and personal media are ignored by Git.

Localhost protection is not public authentication. Do not expose this server on a LAN or through a public tunnel. This milestone checks image signatures but does not perform full decoding, dimension limits, or malware scanning. Live generation is disabled until explicitly approved and configured.

For backup, **stop the app first**, then copy the entire configured data directory, including SQLite sidecars if present. To restore, stop the app, replace that directory with the complete backup, and restart. No automatic cloud sync is implemented. Removing a reference from a draft does not delete the stored original; history may still use it. Asset cleanup is deferred.

## Verification

```powershell
node --check server.mjs
node --check public/app.js
npm run lint
npm run build
npm run typecheck
node --test test/core.test.mjs test/server.test.mjs
```

Use `npm test` (or `node --test test/core.test.mjs test/higgsfield.test.mjs test/worker.test.mjs test/server.test.mjs`) for the full 12-test suite. Tests cover reference mapping, input limits, upload signatures, credential rotation, secret-free status, protected routes, deduplication, restart recovery, history, video ranges, provider payloads, signed-upload header isolation, and worker recovery/consent. Routine provider tests are mocked. Build first: the server test starts production Next.js with a temporary database on port 14311.

Optional browser QA requires an existing Playwright installation. Set `PLAYWRIGHT_MODULE` to its `index.mjs`, start the app on port 4310, then run `node test/browser.mjs`. **This creates synthetic reference uploads and two simulation jobs in the local app**, so run against a disposable data directory if you want empty history. Browser QA saves screenshots and a demo recording under ignored `test-results/`.

See `docs/TEST_RESULTS.md` for observed results and `docs/INTEGRATION.md` for remaining live integration work.

The handoff includes `docs/HANDOFF.md`, `docs/demo.mp4`, and `docs/screenshots/`. On Windows, run `powershell -ExecutionPolicy Bypass -File scripts/package.ps1` after committing changes to create a source/demo archive under ignored `delivery/`. It includes tracked project files only, excluding credentials, databases, original personal references, build output, and installed dependencies.

## Company GitHub handoff

Company repository: https://github.com/etalogics/eta-ai-studio. On Windows, `start-studio.cmd` starts a previously built installation.

Keep the repository private unless the company authorizes otherwise. No API secrets or local runtime data belong in GitHub.
