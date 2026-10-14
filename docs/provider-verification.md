# Provider verification - 14 October 2026

Requested provider: Higgsfield. No alternate provider or model has been substituted.

Official sources inspected:

- https://open.higgsfield.ai/quick-start
- https://docs.higgsfield.ai/docs
- https://docs.higgsfield.ai/docs/llms.txt
- https://open.higgsfield.ai/explore

The quick start documents a complete copied REST credential with `Authorization: Key <credential>` and server-only `HF_API_KEY`. The documentation overview shows a key ID/secret pair joined with a colon. The server configuration accepts either representation, with the complete copied credential taking precedence. This is configuration support, not proof of valid account credentials. No credentials are currently configured.

The official quick start describes signed reference uploads, asynchronous request IDs and status polling, and output URLs. No model-specific endpoint/schema has been selected or verified for this account. No provider calls have been made. There is therefore no approved live model in the UI and no claim that a provider can honor arbitrary local numbered image mentions.

Unverified: approved exact endpoint, allowed durations/ratios, reference roles/counts and token mapping, actual account access, upload destination constraints, result validation, cancellation eligibility, billing outcomes, and optional cost estimation. API billing is separate from website subscription credits. No verified prices are embedded.

Only the simulation model is enabled. Its settings are validated by the server; it accepts up to eight ordered local references for demonstrating the gallery and prompt behavior, without sending them to a provider. Estimates are $0 because no requests are sent. Live cost estimates remain optional under the revised deadline brief.

Before live integration, follow the model-specific documentation from the official catalog, verify its complete schema, implement a server-only adapter and durable polling/download path, then obtain approval for a small paid smoke test. Never infer that website `@image` syntax is accepted by an API model.
