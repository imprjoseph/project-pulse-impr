import type { Metadata } from 'next';
import { Noto_Sans_TC } from 'next/font/google';
import './globals.css';

const notoSans = Noto_Sans_TC({
  variable: '--font-noto-sans-tc',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://project-pulse-impr.impr-joseph.chatgpt.site'),
  title: '人力投入管理｜Project Pulse',
  description: '以週報、專案工時與困難點追蹤，協助團隊平衡人力並降低不必要加班。',
  openGraph: {
    title: '人力投入管理｜Project Pulse',
    description: '週報、專案工時、工作負載，一站掌握。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '人力投入管理系統' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '人力投入管理｜Project Pulse',
    description: '週報、專案工時、工作負載，一站掌握。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className={`${notoSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
