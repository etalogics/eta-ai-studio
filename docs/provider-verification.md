# Provider verification - 14 October 2026

Requested provider: Higgsfield. No alternate provider or model has been substituted.

Official sources inspected:

- https://open.higgsfield.ai/quick-start
- https://docs.higgsfield.ai/docs
- https://docs.higgsfield.ai/docs/llms.txt
- https://open.higgsfield.ai/explore

The server accepts the complete copied REST credential or a key ID/secret pair, using the documented Key authorization scheme. A local credential is now configured and a read-only status check was accepted. This verifies authentication, not model entitlement. No paid generation has been submitted.

Model source: https://open.higgsfield.ai/models/kling-video/v3.0/std/image-to-video/api-reference. Prepared endpoint: `kling-video/v3.0/std/image-to-video`. The adapter uses one `image_url`, a prompt, supported 5/10-second durations, `sound=off`, `cfg_scale=0.5`, and `multi_shots=false`. No ratio parameter or numbered-reference syntax is sent. Multi-image requests are rejected.

Shared sources: https://docs.higgsfield.ai/docs/authentication, https://docs.higgsfield.ai/docs/concepts/file-uploads, https://docs.higgsfield.ai/docs/concepts/requests, https://docs.higgsfield.ai/docs/api-reference/requests/get-request-status. These document signed upload headers, asynchronous states, result URLs, and idempotency. The adapter validates origins and request IDs. API billing is separate from website credits; no current prices are embedded.

Simulation remains the default. The live model is visible, but generation is disabled pending explicit approval and local enablement. Credentials remain server-only. Simulation costs $0; live estimates are optional and displayed as unavailable when unverified.

Unverified with this account: model access, balance, successful generation, signed upload host compatibility, output retrieval, cancellation behavior, and actual charges. The prepared adapter and leased worker are tested with mocks. A real paid smoke test requires approval.
