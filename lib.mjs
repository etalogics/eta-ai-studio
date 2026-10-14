export const MODEL = { id: 'simulation-i2v', name: 'Image-to-video · Simulation', durations: [5, 10], ratios: ['9:16', '16:9', '1:1'], maxReferences: 8 };
export function mentions(prompt) { return [...prompt.matchAll(/@image\s*(\d+)\b/gi)].map(m => Number(m[1])); }
export function validateDraft(draft, assetExists) {
  if (!draft || typeof draft.prompt !== 'string' || !draft.prompt.trim() || draft.prompt.length > 6000) throw new Error('Enter a prompt between 1 and 6,000 characters.');
  if (draft.model !== MODEL.id) throw new Error('Live models are unavailable. Select the clearly labelled simulation model.');
  if (!MODEL.durations.includes(Number(draft.duration)) || !MODEL.ratios.includes(draft.ratio)) throw new Error('Unsupported duration or aspect ratio.');
  if (!Array.isArray(draft.references) || !draft.references.length || draft.references.length > MODEL.maxReferences) throw new Error('Upload between 1 and 8 reference images.');
  if (new Set(draft.references).size !== draft.references.length || draft.references.some(id => typeof id !== 'string' || !assetExists(id))) throw new Error('One or more reference images are missing or duplicated.');
  const invalid = mentions(draft.prompt).find(n => n < 1 || n > draft.references.length);
  if (invalid !== undefined) throw new Error(`@image${invalid} does not exist. Update the prompt or upload another reference.`);
  return { prompt: draft.prompt.trim(), model: MODEL.id, duration: Number(draft.duration), ratio: draft.ratio, references: draft.references, simulateFailure: draft.simulateFailure === true };
}
export function statusAt(job, now = Date.now()) {
  const elapsed = now - job.created;
  return elapsed < 1500 ? 'pending' : elapsed < 5500 ? 'processing' : job.settings.simulateFailure ? 'failed' : 'completed';
}
export function imageType(bytes) {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return ['image/png', '.png'];
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ['image/jpeg', '.jpg'];
  if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return ['image/webp', '.webp'];
  throw new Error('Use a valid PNG, JPEG, or WebP image.');
}
