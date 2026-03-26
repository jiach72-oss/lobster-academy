'use client';

import { useI18n } from '@/lib/i18n';

export default function RegisterPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-4">
          {isZh ? '🦞 入学申请' : '🦞 Enrollment'}
        </h1>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8">
          <p className="text-neutral-400 mb-6">
            {isZh
              ? '使用 CLI 工具在本地入学，数据不出本机。'
              : 'Enroll locally using the CLI tool. Your data never leaves your machine.'}
          </p>
          <pre className="bg-black rounded-lg p-4 text-left text-sm text-green-400 overflow-x-auto mb-4">
{`npm install -g lobster-academy
lobster enroll --agent my-agent`}
          </pre>
          <a href="/docs" className="inline-block px-6 py-2 rounded-lg text-sm font-medium" style={{ background: '#dc2626', color: 'white' }}>
            {isZh ? '查看文档' : 'View Docs'}
          </a>
        </div>
      </div>
    </main>
  );
}
