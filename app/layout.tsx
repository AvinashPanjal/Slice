import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LendWise - Full-Stack Personal Loan & Payment Reminder Ledger',
  description: 'Track money borrowed through loan apps for yourself and friends, monthly dues, flexible payments, and WhatsApp reminders.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LendWise',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0b1c30" />
      </head>
      <body className="min-h-screen antialiased bg-[#f8f9ff] dark:bg-[#0b1c30] text-slate-900 dark:text-white">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('SW registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
