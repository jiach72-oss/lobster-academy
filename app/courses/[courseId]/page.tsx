'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface CourseDetail {
  id: string;
  name_zh: string;
  name_en: string;
  college: string;
  college_zh: string;
  description_zh: string;
  description_en: string;
  objectives_zh: string[];
  objectives_en: string[];
  topics_zh: string[];
  topics_en: string[];
  duration: string;
  difficulty: string;
}

interface ProgressInfo {
  status: string;
  score: number | null;
  attempts: number;
}

export default function CourseDetailPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const params = useParams();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setCourse(data.course);
        setProgress(data.progress);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [courseId]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      if (data.success) {
        setProgress(prev => prev ? { ...prev, status: 'studying' } : null);
        setMessage(isZh ? '已开始学习！' : 'Course started!');
      }
    } catch {
      setMessage(isZh ? '操作失败' : 'Action failed');
    }
    setActionLoading(false);
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      const data = await res.json();
      if (data.success) {
        setProgress({ status: 'passed', score: data.score, attempts: (progress?.attempts || 0) + 1 });
        setMessage(isZh ? `恭喜通过！得分：${data.score}` : `Congratulations! Score: ${data.score}`);
      }
    } catch {
      setMessage(isZh ? '操作失败' : 'Action failed');
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0b0f', color: '#a89b8c' }}>
        <span className="text-4xl animate-pulse">🦞</span>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0b0f' }}>
        <div className="text-center">
          <p style={{ color: '#ef4444' }}>{isZh ? '课程不存在' : 'Course not found'}</p>
          <Link href="/courses" className="text-sm mt-4 inline-block" style={{ color: '#d4a853' }}>{isZh ? '返回课程列表' : 'Back to courses'}</Link>
        </div>
      </div>
    );
  }

  const difficultyLabel = (d: string) => {
    const labels: Record<string, Record<string, string>> = {
      beginner: { zh: '初级', en: 'Beginner' },
      intermediate: { zh: '中级', en: 'Intermediate' },
      advanced: { zh: '高级', en: 'Advanced' },
    };
    return labels[d]?.[isZh ? 'zh' : 'en'] || d;
  };

  const difficultyColor = (d: string) => {
    switch (d) {
      case 'beginner': return '#22c55e';
      case 'intermediate': return '#d4a853';
      case 'advanced': return '#ef4444';
      default: return '#8a7b6b';
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
          <Link href="/courses" className="text-sm hover:text-[#d4a853] transition" style={{ color: '#a89b8c' }}>
            {isZh ? '返回课程' : 'Back to Courses'}
          </Link>
          <LanguageSwitcher />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-8 py-6">
        {/* Course Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-sm px-2 py-1 rounded" style={{ background: 'rgba(212,168,83,0.1)', color: '#6a5b4b' }}>{course.id}</span>
            <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(212,168,83,0.1)', color: '#d4a853' }}>
              {isZh ? course.college_zh : course.college}
            </span>
            <span className="text-xs px-2 py-1 rounded" style={{ background: `${difficultyColor(course.difficulty)}20`, color: difficultyColor(course.difficulty) }}>
              {difficultyLabel(course.difficulty)}
            </span>
            <span className="text-xs" style={{ color: '#6a5b4b' }}>⏱ {course.duration}</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>
            {isZh ? course.name_zh : course.name_en}
          </h1>
        </div>

        {/* Status & Actions */}
        <div className="rounded-lg p-6 mb-8" style={{ background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.2)' }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs mb-1" style={{ color: '#8a7b6b' }}>{isZh ? '当前状态' : 'Status'}</div>
              <div className="text-lg font-bold" style={{
                color: progress?.status === 'passed' ? '#22c55e' : progress?.status === 'studying' ? '#6366f1' : progress?.status === 'available' ? '#d4a853' : '#8a7b6b',
              }}>
                {progress?.status === 'passed' ? (isZh ? '已通过 ✅' : 'Passed ✅') :
                 progress?.status === 'studying' ? (isZh ? '学习中 📖' : 'Studying 📖') :
                 progress?.status === 'available' ? (isZh ? '可学习 📝' : 'Available 📝') :
                 (isZh ? '未解锁 🔒' : 'Locked 🔒')}
              </div>
              {progress?.score !== null && progress?.score !== undefined && (
                <div className="text-sm mt-1" style={{ color: '#6a5b4b' }}>{isZh ? '得分' : 'Score'}: {progress.score}</div>
              )}
            </div>
            <div className="flex gap-3">
              {progress?.status === 'available' && (
                <button
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="px-6 py-2 rounded text-sm font-medium transition hover:opacity-80"
                  style={{ background: 'rgba(212,168,83,0.2)', color: '#d4a853', border: '1px solid rgba(212,168,83,0.3)' }}
                >
                  {isZh ? '开始学习' : 'Start Learning'}
                </button>
              )}
              {progress?.status === 'studying' && (
                <button
                  onClick={handleComplete}
                  disabled={actionLoading}
                  className="px-6 py-2 rounded text-sm font-medium transition hover:opacity-80"
                  style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                >
                  {isZh ? '完成课程' : 'Complete Course'}
                </button>
              )}
              {progress?.status === 'passed' && (
                <Link href="/dashboard" className="px-6 py-2 rounded text-sm font-medium" style={{ background: 'rgba(212,168,83,0.1)', color: '#d4a853', border: '1px solid rgba(212,168,83,0.2)' }}>
                  {isZh ? '查看仪表板' : 'View Dashboard'}
                </Link>
              )}
            </div>
          </div>
          {message && (
            <div className="mt-3 text-sm" style={{ color: '#22c55e' }}>{message}</div>
          )}
        </div>

        {/* Description */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: '#d4a853' }}>{isZh ? '课程简介' : 'Description'}</h2>
          <p className="text-sm leading-relaxed" style={{ color: '#a89b8c' }}>
            {isZh ? course.description_zh : course.description_en}
          </p>
        </div>

        {/* Learning Objectives */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: '#d4a853' }}>{isZh ? '学习目标' : 'Learning Objectives'}</h2>
          <div className="space-y-2">
            {(isZh ? course.objectives_zh : course.objectives_en).map((obj, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(212,168,83,0.03)', border: '1px solid rgba(212,168,83,0.08)' }}>
                <span style={{ color: '#d4a853' }}>🎯</span>
                <span className="text-sm" style={{ color: '#a89b8c' }}>{obj}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Topics */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: '#d4a853' }}>{isZh ? '知识点' : 'Topics'}</h2>
          <div className="flex flex-wrap gap-2">
            {(isZh ? course.topics_zh : course.topics_en).map((topic, i) => (
              <span key={i} className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(212,168,83,0.08)', color: '#a89b8c', border: '1px solid rgba(212,168,83,0.12)' }}>
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
