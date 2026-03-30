'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: '总览仪表板', icon: '📊' },
  { href: '/evaluations', label: '评测报告', icon: '📈' },
  { href: '/security', label: '安全测试', icon: '🛡️' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-dark-800 border-r border-dark-600 flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-dark-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-xl">
            🦞
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Lobster Academy</h1>
            <p className="text-xs text-dark-200">AI Agent 行为证据平台</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <p className="text-xs font-semibold text-dark-300 uppercase tracking-wider mb-3 px-3">
          导航
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-accent-blue/15 text-accent-blue'
                      : 'text-dark-200 hover:text-white hover:bg-dark-700'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-dark-600">
        <div className="text-xs text-dark-300">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            系统正常运行
          </div>
          <div>版本 v1.0.0-beta</div>
        </div>
      </div>
    </aside>
  );
}
