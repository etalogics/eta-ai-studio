# Eta Logics AI Creator Studio

A working local first milestone: ordered image references, prompt mentions, image-to-video settings, simulated generation states, playable/downloadable sample output, and persistent generation history.

**Simulation only.** No live AI adapter is installed, no credentials are used for requests, and no paid requests are sent. Output is a bundled synthetic animation matching the chosen 5- or 10-second duration and aspect ratio, clearly labelled in the UI. It does not depict the uploaded reference or execute the prompt.

## Run locally

Requires **Node.js 22.17.0 or newer** with `node:sqlite`. Tested on Windows with Node 22.17.0. SQLite is experimental in that Node version and may print a warning. Stack: Next.js 16.4 App Router, React 19.3, TypeScript 6, Tailwind 4, Zod, SQLite, and local filesystem storage. The lockfile records exact compatible dependency versions. The UI uses a server-rendered trusted workspace shell enhanced by a browser controller; API routes and storage are written in TypeScript.

```powershell
cd D:\web-projects\wareesha-portfolio\ai-creator-studio
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4310**. For development use `npm run dev` (or `node server.mjs`). For production build use `npm run build` (or `node scripts/build.mjs`), then `npm start` (or `node server.mjs --production`). On macOS/Linux, enter the equivalent checkout directory and use the same commands. Use the custom server scripts so the loopback binding and local session protections are established; do not replace them with an unconfigured `next start` command.

If the Windows npm launcher reports a missing npm-cli.js, use the npm CLI bundled with your Node installation, for example `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" ci`. This workaround was used during development. The final framework migration supersedes the initial plain-Node prototype.

Optional configuration: copy `.env.example` to `.env`; set `PORT` and/or an absolute `STUDIO_DATA_DIR`. Restart after changes. API credentials must remain in `.env`, never browser code. The server supports `HF_API_KEY` with the complete copied REST credential, or `HF_API_KEY_ID` plus `HF_API_KEY_SECRET`. Set `STUDIO_PROVIDER=higgsfield` and record the approved exact endpoint in `STUDIO_APPROVED_MODEL` once verified. Settings reports only whether configuration is present; it never returns credential values. Configuring a key does not validate it or enable live generation. See `docs/provider-verification.md` for the official sources and verification limits.

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

Localhost protection is not public authentication. Do not expose this server on a LAN or through a public tunnel. This first milestone checks image signatures but does not perform full decoding, dimension limits, or malware scanning. There is no paid generation path.

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

Tests cover numbered-position mapping, unsupported inputs, nonexistent references, status transitions, upload signatures, secret-free provider status, session/Origin protection, duplicate submissions, restart recovery, saved draft order, failed generation, protected media, and video range requests. Build first: the integration test starts the production Next.js server, using a temporary data directory and port 14311.

Optional browser QA requires an existing Playwright installation. Set `PLAYWRIGHT_MODULE` to its `index.mjs`, start the app on port 4310, then run `node test/browser.mjs`. **This creates synthetic reference uploads and two simulation jobs in the local app**, so run against a disposable data directory if you want empty history. Browser QA saves screenshots and a demo recording under ignored `test-results/`.

See `docs/TEST_RESULTS.md` for observed results and `docs/INTEGRATION.md` for remaining live integration work.

The handoff includes `docs/HANDOFF.md`, `docs/demo.mp4`, and `docs/screenshots/`. On Windows, run `powershell -ExecutionPolicy Bypass -File scripts/package.ps1` after committing changes to create a source/demo archive under ignored `delivery/`. It includes tracked project files only, excluding credentials, databases, original personal references, build output, and installed dependencies.

## Company GitHub handoff

This folder is prepared as a separate repository. The company organization/repository destination is still required before upload. Do not publish it as part of the surrounding portfolio repository.

After receiving an approved empty company repository URL:

```powershell
git remote add origin <approved-company-repository-url>
git push -u origin main
```

Keep the repository private unless the company authorizes otherwise. No API secrets or local runtime data belong in GitHub.
