import { readFileSync } from 'node:fs';
import path from 'node:path';
import Script from 'next/script';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Trusted, repository-owned workspace markup. No user content is inserted here.
// The existing tested browser controller enhances this server-rendered shell.
export default async function StudioPage() {
  const template = readFileSync(path.join(process.cwd(), 'public/index.html'), 'utf8');
  const markup = template.split('<body>')[1].split('</body>')[0];
  const nonce = (await headers()).get('x-studio-nonce') || undefined;
  return <><div dangerouslySetInnerHTML={{ __html: markup }} /><Script src="/app.js" nonce={nonce} strategy="afterInteractive" /></>;
}
