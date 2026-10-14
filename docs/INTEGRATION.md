# Higgsfield integration

The local credential is configured outside Git. A read-only request-status check was accepted on 14 October 2026. This validates authentication, not model entitlement, balance, or a successful generation. No paid generation has been sent.

Prepared model: `kling-video/v3.0/std/image-to-video` (Kling 3.0 Standard). It accepts one start frame. This adapter uses 5/10 seconds, sound off, and single-shot mode. Ratio comes from the start image; no ratio parameter is sent. Multiple references and local `@image` mentions are rejected rather than ignored. Other models are not silently substituted.

The adapter uses signed uploads, server-only authorization, stable idempotency tokens, saved request/status IDs, background polling, streaming downloads, temporary files, and atomic output publication. SQLite leases prevent concurrent workers from claiming the same job. Restart resumes existing provider IDs. Ambiguous submissions without an ID enter `unknown` and are not automatically resubmitted. Media destinations and redirects must match trusted HTTPS hosts.

Live execution is **disabled at the user's explicit request on 14 October 2026**. No paid smoke test is authorized. Only after new explicit approval for the exact model and a paid run may an operator set these local environment fields and restart:

```dotenv
STUDIO_APPROVED_MODEL=kling-video/v3.0/std/image-to-video
STUDIO_LIVE_ENABLED=true
```

The account must have a successful authentication check matching the current credential. Run `node scripts/verify-provider.mjs` from the project directory after the app has initialized its database. Changing the credential invalidates the recorded fingerprint until verification is repeated. The browser sees status flags only.

Each live generation additionally requires a fresh paid-consent checkbox and Generate click. Applying history settings clears consent. An unavailable estimate does not block an otherwise approved request, per the revised brief; the UI never displays simulated $0 costs as a live price. This milestone does not implement an app-wide spending budget.

The adapter and worker have mocked tests. Real model submission, account balance, signed-storage host compatibility, provider output retrieval, and actual billing remain untested until a paid smoke test is approved. If a provider media host is outside the trusted set, verify it before adding its exact hostname to `STUDIO_MEDIA_HOSTS`; do not disable URL validation.

Because a credential was posted in chat, rotate it through the provider console before ongoing use. Put replacement credentials directly in the local `.env`; never commit or share them.
