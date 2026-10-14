// Imported only by the Node server. Never serialize credential values to clients.
import { createHash } from 'node:crypto';
export function readProviderConfig(env = process.env) {
  const provider = env.STUDIO_PROVIDER || 'higgsfield';
  const id = env.HF_API_KEY_ID?.trim();
  const secret = env.HF_API_KEY_SECRET?.trim();
  const credential = env.HF_API_KEY?.trim() || (id && secret ? `${id}:${secret}` : '');
  return { provider, credential, fingerprint:createHash('sha256').update(credential).digest('hex'), baseUrl: 'https://api.higgsfield.ai', approvedModel: env.STUDIO_APPROVED_MODEL || null, liveEnabled:env.STUDIO_LIVE_ENABLED === 'true', mediaHosts:(env.STUDIO_MEDIA_HOSTS || '').split(',').map(v=>v.trim()).filter(Boolean) };
}
export function publicProviderStatus(config, verification = null) {
  const verified = Boolean(verification?.accepted && verification.fingerprint === config.fingerprint && config.credential);
  const enabled = Boolean(config.provider==='higgsfield' && verified && config.liveEnabled && config.approvedModel === 'kling-video/v3.0/std/image-to-video');
  return {
    provider: config.provider === 'higgsfield' ? 'Higgsfield' : 'Unsupported provider',
    credentialsConfigured: Boolean(config.credential),
    modelConfigured: Boolean(config.approvedModel),
    liveEnabled: enabled,
    credentialVerified: verified,
    checkedAt: verified ? verification.checkedAt : null,
    mode: 'simulation',
    blockers: [
      ...(!config.credential ? ['Add Higgsfield credentials to the local .env file.'] : verified ? [] : ['Credentials are configured but have not been validated against the provider.']),
      ...(enabled ? [] : ['Live adapter is prepared for Kling 3.0 Standard image-to-video. Confirm that model before enabling it.', 'Obtain paid-generation approval before setting STUDIO_LIVE_ENABLED=true.']),
      'Kling accepts one start frame; numbered multi-image mentions are not supported by this adapter.'
    ]
  };
}
