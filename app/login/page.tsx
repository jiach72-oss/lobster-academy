'use client';

import { useI18n } from '@/lib/i18n';

export default function LoginPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-4">
          {isZh ? '🦞 登录' : '🦞 Login'}
        </h1>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8">
          <p className="text-neutral-400 mb-6">
            {isZh
              ? '使用 CLI 工具查看 Agent 状态。'
              : 'Check your Agent status using the CLI tool.'}
          </p>
          <pre className="bg-black rounded-lg p-4 text-left text-sm text-green-400 overflow-x-auto mb-4">
{`lobster status --agent my-agent`}
          </pre>
          <a href="/docs" className="inline-block px-6 py-2 rounded-lg text-sm font-medium" style={{ background: '#dc2626', color: 'white' }}>
            {isZh ? '查看文档' : 'View Docs'}
          </a>
        </div>
      </div>
    </main>
  );
}
