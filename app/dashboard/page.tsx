'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { DashboardData, Course, RankingEntry } from '@/types';

export default function DashboardPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<'progress' | 'certificate' | 'ranking'>('progress');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setData)
      .catch(() => window.location.href = '/login');
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0b0f', color: '#a89b8c' }}>
        <span className="text-4xl animate-pulse">🦞</span>
      </div>
    );
  }

  const { student, courses, ranking } = data;
  const completedCount = courses.filter((c: Course) => c.status === 'passed').length;
  const progressPercent = Math.round((completedCount / courses.length) * 100);

  return (
    <div className="min-h-screen" style={{ background: '#0d0b0f' }}>
      {/* Header */}
      <nav className="flex justify-between items-center max-w-5xl mx-auto px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦞</span>
          <div>
            <div className="text-sm font-bold" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>
              {isZh ? '龙虾学院' : 'Lobster Academy'}
            </div>
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <Link href="/" className="text-sm hover:text-[#d4a853] transition" style={{ color: '#a89b8c' }}>
            {isZh ? '首页' : 'Home'}
          </Link>
          <LanguageSwitcher />
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="text-sm px-3 py-1 rounded transition hover:opacity-80"
            style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            {isZh ? '登出' : 'Logout'}
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-8 py-6">
        {/* Student Info Card */}
        <div className="rounded-lg p-6 mb-8" style={{ background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.2)' }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🦞</span>
                <span className="text-lg font-bold" style={{ color: '#d4a853' }}>{student.agentName}</span>
              </div>
              <div className="text-xs font-mono" style={{ color: '#8a7b6b' }}>{student.studentId}</div>
              <div className="flex gap-3 mt-3">
                <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(212,168,83,0.1)', color: '#d4a853' }}>
                  🏛️ {student.college || (isZh ? '未分院' : 'Undecided')}
                </span>
                <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                  {isZh ? '等级' : 'Grade'}: {student.grade}
                </span>
                <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                  {student.score} pts
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: '#d4a853' }}>{progressPercent}%</div>
              <div className="text-xs" style={{ color: '#8a7b6b' }}>{isZh ? '课程完成' : 'Completed'}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(212,168,83,0.1)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #d4a853, #22c55e)' }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          {[
            { id: 'progress' as const, label: isZh ? '📚 学习进度' : '📚 Progress' },
            { id: 'certificate' as const, label: isZh ? '🎓 毕业证书' : '🎓 Certificate' },
            { id: 'ranking' as const, label: isZh ? '🏆 排名' : '🏆 Ranking' },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded text-sm transition"
              style={{
                background: tab === t.id ? 'rgba(212,168,83,0.2)' : 'transparent',
                color: tab === t.id ? '#d4a853' : '#8a7b6b',
                border: '1px solid rgba(212,168,83,0.15)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'progress' && (
          <div className="space-y-3">
            {courses.map((course: Course, i: number) => (
              <div key={i} className="p-4 rounded-lg flex justify-between items-center"
                style={{ background: 'rgba(212,168,83,0.03)', border: '1px solid rgba(212,168,83,0.1)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {course.status === 'passed' ? '✅' : course.status === 'studying' ? '📖' : course.status === 'locked' ? '🔒' : '📝'}
                  </span>
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#a89b8c' }}>{course.name}</div>
                    <div className="text-xs" style={{ color: '#6a5b4b' }}>{course.college}</div>
                  </div>
                </div>
                <div className="text-right">
                  {course.score !== null ? (
                    <>
                      <div className="text-sm font-bold" style={{ color: course.score >= 80 ? '#22c55e' : '#f59e0b' }}>{course.score}</div>
                      <div className="text-xs" style={{ color: '#6a5b4b' }}>{isZh ? '考试分数' : 'Exam Score'}</div>
                    </>
                  ) : (
                    <div className="text-xs" style={{ color: '#6a5b4b' }}>
                      {course.status === 'studying' ? (isZh ? '学习中' : 'Studying') : course.status === 'locked' ? (isZh ? '未解锁' : 'Locked') : (isZh ? '待学习' : 'Pending')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'certificate' && (
          <div className="text-center py-12">
            {student.graduated ? (
              <div className="rounded-lg p-8 max-w-md mx-auto" style={{ background: 'rgba(212,168,83,0.05)', border: '2px solid rgba(212,168,83,0.3)' }}>
                <span className="text-6xl">🎓</span>
                <h2 className="text-xl font-bold mt-4" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>
                  {isZh ? '毕业证书' : 'Certificate of Graduation'}
                </h2>
                <div className="my-4 py-4" style={{ borderTop: '1px solid rgba(212,168,83,0.2)', borderBottom: '1px solid rgba(212,168,83,0.2)' }}>
                  <div className="text-2xl font-bold mb-1" style={{ color: '#d4a853' }}>{student.agentName}</div>
                  <div className="text-xs font-mono" style={{ color: '#8a7b6b' }}>{student.studentId}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div>
                    <div className="text-xs" style={{ color: '#8a7b6b' }}>{isZh ? '等级' : 'Grade'}</div>
                    <div className="text-xl font-bold" style={{ color: '#22c55e' }}>{student.grade}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: '#8a7b6b' }}>{isZh ? '总分' : 'Score'}</div>
                    <div className="text-xl font-bold" style={{ color: '#d4a853' }}>{student.score}</div>
                  </div>
                </div>
                <div className="mt-4 text-xs font-mono" style={{ color: '#6a5b4b' }}>
                  {isZh ? '签发日期' : 'Issued'}: {student.graduatedAt ? new Date(student.graduatedAt).toLocaleDateString() : '2026-03-24'}
                </div>
                <div className="mt-2 text-xs" style={{ color: '#6a5b4b' }}>
                  Cert ID: {student.certId || `CERT-${student.studentId}`}
                </div>
              </div>
            ) : (
              <div>
                <span className="text-6xl opacity-40">🎓</span>
                <p className="text-sm mt-4" style={{ color: '#8a7b6b' }}>
                  {isZh ? '尚未毕业。完成所有课程学习即可获得毕业证书。' : 'Not yet graduated. Complete all courses to earn your certificate.'}
                </p>
                <div className="mt-4 text-sm" style={{ color: '#d4a853' }}>
                  {isZh ? `已完成 ${completedCount}/${courses.length} 门课程` : `${completedCount}/${courses.length} courses completed`}
                </div>
                {completedCount === courses.length && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/graduate', { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                          window.location.reload();
                        } else {
                          alert(data.error || 'Graduation failed');
                        }
                      } catch {
                        alert('Graduation failed');
                      }
                    }}
                    className="mt-4 px-6 py-2 rounded text-sm font-medium transition hover:opacity-80"
                    style={{ background: 'rgba(212,168,83,0.2)', color: '#d4a853', border: '1px solid rgba(212,168,83,0.3)' }}
                  >
                    {isZh ? '🎓 申请毕业' : '🎓 Apply for Graduation'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'ranking' && (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(212,168,83,0.15)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'rgba(212,168,83,0.08)' }}>
                  <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: '#8a7b6b' }}>#</th>
                  <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: '#8a7b6b' }}>{isZh ? '龙虾名' : 'Agent'}</th>
                  <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: '#8a7b6b' }}>{isZh ? '学院' : 'College'}</th>
                  <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: '#8a7b6b' }}>{isZh ? '分数' : 'Score'}</th>
                  <th className="text-center py-3 px-4 text-xs font-medium" style={{ color: '#8a7b6b' }}>{isZh ? '等级' : 'Grade'}</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((s: RankingEntry, i: number) => (
                  <tr key={i} style={{
                    borderBottom: '1px solid rgba(212,168,83,0.08)',
                    background: s.isMe ? 'rgba(212,168,83,0.08)' : 'transparent',
                  }}>
                    <td className="py-3 px-4 text-sm font-bold" style={{ color: i < 3 ? '#d4a853' : '#6a5b4b' }}>
                      {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm" style={{ color: s.isMe ? '#d4a853' : '#a89b8c' }}>
                        {s.badge || ''} {s.name} {s.isMe ? '(You)' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(212,168,83,0.1)', color: '#d4a853' }}>{s.college}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-bold" style={{ color: s.score >= 90 ? '#22c55e' : s.score >= 80 ? '#d4a853' : '#f59e0b' }}>{s.score}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm font-bold px-2 py-1 rounded" style={{
                        background: s.grade === 'S' ? 'rgba(234,179,8,0.15)' : s.grade === 'A' ? 'rgba(34,197,94,0.15)' : 'rgba(212,168,83,0.15)',
                        color: s.grade === 'S' ? '#eab308' : s.grade === 'A' ? '#22c55e' : '#d4a853',
                      }}>{s.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
