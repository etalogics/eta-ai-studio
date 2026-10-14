# Live provider integration: pending

The requested provider in the original brief is Higgsfield. No provider substitution has been made. The revised first milestone explicitly permits simulation when access or supported inputs are unavailable. This build implements that fallback and does not claim a tested live integration.

Remaining requirements:

1. Confirm the approved provider/model and obtain API account access and balance. Keep credentials local; do not send them in chat.
2. Verify current official authentication and model catalog at https://open.higgsfield.ai and https://docs.higgsfield.ai at integration time. Verify upload transport, supported durations/ratios, start-frame behavior, reference counts/roles, native mention syntax, status/result retrieval, output expiry, and billing behavior.
3. Implement a server-only provider adapter. Upload bytes via documented transport; provider servers cannot fetch localhost assets. Persist request IDs and normalized results.
4. If the approved image-to-video model accepts only one start frame, block requests that require multiple images. Do not forward app `@image` tokens unless documented provider behavior or a documented mapping can honor their meaning. Show supported capabilities in the UI and validate them server-side.
5. Add a durable worker, careful ambiguous-submit recovery, and documented provider idempotency if available. Stream downloaded real outputs into local storage. Do not retry generation blindly after timeouts.
6. Cost estimates are optional per the revised brief. Label unavailable estimates honestly; they must not block approved generation in this milestone. Do not fabricate prices.
7. Obtain explicit approval before any billable smoke test. Until then keep live generation disabled.

The demo job lifecycle uses persisted timestamps; it needs no independent worker. It is not proof of provider polling, output downloading, or actual billing. No actual live job ran.

Deferred: characters, presets, additional providers, detailed cost reporting, cloud hosting, and the original full brief's broader reliability/security acceptance requirements.
