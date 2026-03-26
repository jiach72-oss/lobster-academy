import './globals.css';
import type { Metadata } from 'next';
import { I18nProvider } from '@/lib/i18n';
import ErrorBoundary from '@/components/ErrorBoundary';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Lobster Academy — AI Agent Training & Evaluation Platform',
  description: 'Blackbox SDK for AI Agent behavior recording, adversarial evaluation, and compliance reporting. 208 PII patterns, 53 attack scenarios, EU AI Act ready.',
  keywords: ['AI Agent', 'evaluation', 'security', 'blackbox', 'compliance', 'EU AI Act', 'SOC2'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: '#0a0a0a' }}>
        <ErrorBoundary>
          <I18nProvider>
            <Navbar />
            <main className="pt-16">
              {children}
            </main>
            <Footer />
          </I18nProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
