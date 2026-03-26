'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

const COMMANDS = [
  { cmd: 'npm install -g lobster-academy', comment: '# Install CLI globally' },
  { cmd: 'lobster enroll --agent my-agent', comment: '# Register your Agent' },
  { cmd: 'lobster check', comment: '# Run health evaluation' },
  { cmd: 'lobster report --format html', comment: '# Generate compliance report' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="px-2 py-1 text-xs rounded transition"
      style={{
        background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
        color: copied ? '#22c55e' : '#737373',
      }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

export default function CLI() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const allCmds = COMMANDS.map(c => c.cmd).join('\n');

  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {isZh ? 'CLI 工具' : 'CLI Tool'}
          </h2>
          <p className="text-neutral-500">
            {isZh ? '一行命令完成Agent注册、评测和报告' : 'One command to enroll, evaluate, and report'}
          </p>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: '#111', border: '1px solid #222' }}>
          <div className="flex items-center justify-between px-4 py-2" style={{ background: '#161616', borderBottom: '1px solid #222' }}>
            <span className="text-xs text-neutral-500 font-mono">terminal</span>
            <CopyButton text={allCmds} />
          </div>
          <pre className="p-5 text-sm leading-7 overflow-x-auto">
            {COMMANDS.map((c, i) => (
              <div key={i}>
                <span className="text-neutral-600">$ </span>
                <span className="text-neutral-200">{c.cmd}</span>
                <span className="text-neutral-600 ml-3">{c.comment}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </section>
  );
}
