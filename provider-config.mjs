// Imported only by the Node server. Never serialize credential values to clients.
export function readProviderConfig(env = process.env) {
  const provider = env.STUDIO_PROVIDER || 'higgsfield';
  const id = env.HF_API_KEY_ID?.trim();
  const secret = env.HF_API_KEY_SECRET?.trim();
  const credential = env.HF_API_KEY?.trim() || (id && secret ? `${id}:${secret}` : '');
  return { provider, credential, baseUrl: 'https://api.higgsfield.ai', approvedModel: env.STUDIO_APPROVED_MODEL || null };
}
export function publicProviderStatus(config) {
  return {
    provider: config.provider === 'higgsfield' ? 'Higgsfield' : 'Unsupported provider',
    credentialsConfigured: Boolean(config.credential),
    modelConfigured: Boolean(config.approvedModel),
    liveEnabled: false,
    credentialVerified: false,
    mode: 'simulation',
    blockers: [
      ...(!config.credential ? ['Add Higgsfield credentials to the local .env file.'] : ['Credentials are configured but have not been validated against the provider.']),
      'Confirm an approved model and verify its exact API schema, uploads, and reference capabilities.',
      'Implement and test the model adapter before live generation is enabled.',
      'Obtain approval before a paid smoke test.'
    ]
  };
}
