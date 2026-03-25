import './globals.css';
import type { Metadata } from 'next';
import { I18nProvider } from '@/lib/i18n';
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Lobster Academy | 龙虾学院',
  description: 'Train, evaluate, and certify your AI Agent',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ErrorBoundary>
          <I18nProvider>
            {children}
          </I18nProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
