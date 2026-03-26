'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar() {
  const { locale } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isZh = locale === 'zh';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b" style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', borderColor: '#222' }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl">🦞</span>
          <span className="text-lg font-bold tracking-tight text-white group-hover:text-[#dc2626] transition">
            Lobster Academy
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/docs" className="text-sm text-neutral-400 hover:text-white transition">
            {isZh ? '文档' : 'Docs'}
          </Link>
          <Link href="/check" className="text-sm text-neutral-400 hover:text-white transition">
            {isZh ? '体检' : 'Check'}
          </Link>
          <Link href="/passport" className="text-sm text-neutral-400 hover:text-white transition">
            {isZh ? '护照' : 'Passport'}
          </Link>
          <a href="https://github.com/lobster-academy" target="_blank" rel="noopener noreferrer"
            className="text-sm text-neutral-400 hover:text-white transition flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
          <LanguageSwitcher />
          <Link href="/login"
            className="text-sm px-4 py-2 rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c] transition font-medium">
            {isZh ? '开始使用' : 'Get Started'}
          </Link>
        </div>

        {/* Mobile menu button */}
        <button className="md:hidden text-neutral-400" onClick={() => setMobileOpen(!mobileOpen)}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t px-6 py-4 space-y-3" style={{ background: '#0a0a0a', borderColor: '#222' }}>
          <Link href="/docs" className="block text-sm text-neutral-400 hover:text-white" onClick={() => setMobileOpen(false)}>Docs</Link>
          <Link href="/check" className="block text-sm text-neutral-400 hover:text-white" onClick={() => setMobileOpen(false)}>Check</Link>
          <Link href="/passport" className="block text-sm text-neutral-400 hover:text-white" onClick={() => setMobileOpen(false)}>Passport</Link>
          <Link href="/login" className="block text-sm px-4 py-2 rounded-lg bg-[#dc2626] text-white text-center" onClick={() => setMobileOpen(false)}>Get Started</Link>
          <LanguageSwitcher />
        </div>
      )}
    </nav>
  );
}
