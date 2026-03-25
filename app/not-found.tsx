import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4" style={{ color: '#d4a853' }}>404</h1>
        <p className="text-xl mb-8" style={{ color: '#9ca3af' }}>页面不存在</p>
        <Link href="/" className="px-6 py-3 rounded-lg font-semibold" style={{ background: '#d4a853', color: '#0a0a0a' }}>
          返回首页
        </Link>
      </div>
    </div>
  );
}
