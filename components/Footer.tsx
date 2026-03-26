'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export default function Footer() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  return (
    <footer className="border-t py-12 px-6" style={{ borderColor: '#1a1a1a' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🦞</span>
              <span className="font-bold text-white">Lobster Academy</span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              {isZh ? '每只龙虾都该有一个黑匣子' : 'Every Agent deserves a black box'}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">{isZh ? '产品' : 'Product'}</h4>
            <div className="space-y-2">
              <Link href="/docs" className="block text-sm text-neutral-500 hover:text-white transition">{isZh ? '文档' : 'Docs'}</Link>
              <Link href="/check" className="block text-sm text-neutral-500 hover:text-white transition">{isZh ? 'Agent体检' : 'Agent Check'}</Link>
              <Link href="/passport" className="block text-sm text-neutral-500 hover:text-white transition">{isZh ? 'Agent护照' : 'Agent Passport'}</Link>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">{isZh ? '资源' : 'Resources'}</h4>
            <div className="space-y-2">
              <a href="https://github.com/jiach72-oss/lobster-academy" target="_blank" rel="noopener noreferrer" className="block text-sm text-neutral-500 hover:text-white transition">GitHub</a>
              <a href="https://www.npmjs.com/package/@lobster-academy/blackbox" target="_blank" rel="noopener noreferrer" className="block text-sm text-neutral-500 hover:text-white transition">npm</a>
              <Link href="/docs" className="block text-sm text-neutral-500 hover:text-white transition">{isZh ? 'API参考' : 'API Reference'}</Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">{isZh ? '合规' : 'Compliance'}</h4>
            <div className="space-y-2">
              <span className="block text-sm text-neutral-500">EU AI Act</span>
              <span className="block text-sm text-neutral-500">SOC2</span>
              <span className="block text-sm text-neutral-500">Ed25519</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 flex flex-col md:flex-row justify-between items-center gap-3" style={{ borderColor: '#1a1a1a' }}>
          <p className="text-xs text-neutral-600">
            © 2026 Lobster Academy. {isZh ? '保留所有权利' : 'All rights reserved.'}
          </p>
          <p className="text-xs text-neutral-700">
            Built with 🦞 by the Lobster Academy team
          </p>
        </div>
      </div>
    </footer>
  );
}
