import type { Metadata } from 'next';
import localFont from 'next/font/local';

import './globals.css';

const geistSans = localFont({
  src: '../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2',
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = localFont({
  src: '../../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2',
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TikTok 1P Demo - Turn Landing Pages Into Instant Forms',
  description: 'See how AI automatically converts your existing landing pages into high-converting TikTok Instant Forms in under 8 seconds.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white">{children}</body>
    </html>
  );
}
