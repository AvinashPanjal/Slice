import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LendWise - Full-Stack Personal Loan & Payment Reminder Ledger',
  description: 'Track money borrowed through loan apps for yourself and friends, monthly dues, flexible payments, and WhatsApp reminders.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased bg-[#f8f9ff] dark:bg-[#0b1c30] text-slate-900 dark:text-white">
        {children}
      </body>
    </html>
  );
}
