'use client';

import Hero from '@/components/Hero';
import Features from '@/components/Features';
import CLI from '@/components/CLI';
import Integrations from '@/components/Integrations';
import Architecture from '@/components/Architecture';
import Stats from '@/components/Stats';

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      <Hero />
      <div style={{ borderTop: '1px solid #1a1a1a' }} />
      <Features />
      <div style={{ borderTop: '1px solid #1a1a1a' }} />
      <CLI />
      <div style={{ borderTop: '1px solid #1a1a1a' }} />
      <Integrations />
      <div style={{ borderTop: '1px solid #1a1a1a' }} />
      <Architecture />
      <div style={{ borderTop: '1px solid #1a1a1a' }} />
      <Stats />
    </div>
  );
}
