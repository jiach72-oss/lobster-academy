'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface CourseItem {
  id: string;
  name: string;
  name_zh: string;
  college: string;
  college_zh: string;
  status: 'locked' | 'available' | 'studying' | 'passed';
  score: number | null;
}

export default function CoursesPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        setCourses(data.courses || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const collegeColors: Record<string, string> = {
    '安全学院': 'rgba(239,68,68,0.15)',
    'Security': 'rgba(239,68,68,0.15)',
    '推理学院': 'rgba(99,102,241,0.15)',
    'Reasoning': 'rgba(99,102,241,0.15)',
    '工具学院': 'rgba(34,197,94,0.15)',
    'Tool': 'rgba(34,197,94,0.15)',
    '合规学院': 'rgba(234,179,8,0.15)',
    'Compliance': 'rgba(234,179,8,0.15)',
  };

  const collegeTextColors: Record<string, string> = {
    '安全学院': '#ef4444',
    'Security': '#ef4444',
    '推理学院': '#6366f1',
    'Reasoning': '#6366f1',
    '工具学院': '#22c55e',
    'Tool': '#22c55e',
    '合规学院': '#eab308',
    'Compliance': '#eab308',
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'passed': return '✅';
      case 'studying': return '📖';
      case 'locked': return '🔒';
      default: return '📝';
    }
  };

  const statusLabel = (status: string) => {
    if (isZh) {
      switch (status) {
        case 'passed': return '已通过';
        case 'studying': return '学习中';
        case 'locked': return '未解锁';
        default: return '可学习';
      }
    }
    switch (status) {
      case 'passed': return 'Passed';
      case 'studying': return 'Studying';
      case 'locked': return 'Locked';
      default: return 'Available';
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#0d0b0f' }}>
      {/* Header */}
      <nav className="flex justify-between items-center max-w-5xl mx-auto px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦞</span>
          <div>
            <div className="text-sm font-bold" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>{isZh ? '龙虾学院' : 'Lobster Academy'}</div>
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <Link href="/dashboard" className="text-sm hover:text-[#d4a853] transition" style={{ color: '#a89b8c' }}>
            {isZh ? '仪表板' : 'Dashboard'}
          </Link>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Main */}
      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>
          {isZh ? '核心课程' : 'Core Courses'}
        </h1>
        <p className="text-sm mb-8" style={{ color: '#8a7b6b' }}>
          {isZh ? '四大学院 · 12门课程 · 完成全部课程即可毕业' : 'Four Colleges · 12 Courses · Complete all to graduate'}
        </p>

        {loading ? (
          <div className="text-center py-20">
            <span className="text-4xl animate-pulse">🦞</span>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ color: '#8a7b6b' }}>{isZh ? '请先登录以查看课程' : 'Please login to view courses'}</p>
            <Link href="/login" className="inline-block mt-4 px-6 py-2 rounded text-sm" style={{ background: 'rgba(212,168,83,0.2)', color: '#d4a853', border: '1px solid rgba(212,168,83,0.3)' }}>
              {isZh ? '去登录' : 'Login'}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => {
              const college = isZh ? course.college : course.college_zh === '安全学院' ? 'Security' : course.college_zh === '推理学院' ? 'Reasoning' : course.college_zh === '工具学院' ? 'Tool' : 'Compliance';
              return (
                <Link
                  key={course.id}
                  href={course.status === 'locked' ? '#' : `/courses/${course.id}`}
                  className={`block p-5 rounded-lg transition ${course.status === 'locked' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01] cursor-pointer'}`}
                  style={{ background: 'rgba(212,168,83,0.03)', border: '1px solid rgba(212,168,83,0.12)' }}
                  onClick={(e) => { if (course.status === 'locked') e.preventDefault(); }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className="text-xl">{statusIcon(course.status)}</span>
                      <div>
                        <div className="text-sm font-medium" style={{ color: '#d4a853' }}>
                          <span className="font-mono mr-2" style={{ color: '#6a5b4b', fontSize: '12px' }}>{course.id}</span>
                          {isZh ? course.name_zh : course.name}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded mt-1 inline-block" style={{
                          background: collegeColors[course.college_zh] || 'rgba(212,168,83,0.1)',
                          color: collegeTextColors[course.college_zh] || '#d4a853',
                        }}>
                          {isZh ? course.college_zh : college}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs px-2 py-1 rounded" style={{
                        background: course.status === 'passed' ? 'rgba(34,197,94,0.15)' : course.status === 'studying' ? 'rgba(99,102,241,0.15)' : 'rgba(138,123,107,0.1)',
                        color: course.status === 'passed' ? '#22c55e' : course.status === 'studying' ? '#6366f1' : '#8a7b6b',
                      }}>
                        {statusLabel(course.status)}
                      </span>
                      {course.score !== null && (
                        <div className="text-xs mt-1" style={{ color: '#6a5b4b' }}>{course.score} pts</div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
