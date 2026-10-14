import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Eta Logics · Creator Studio',
  description: 'Private local image-to-video workspace with a clearly labelled simulation.'
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
