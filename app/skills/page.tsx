'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { SkillApiResponse } from '@/types';

export default function SkillsPage() {
  const { t, locale } = useI18n();
  const [skills, setSkills] = useState<SkillApiResponse[]>([]);
  const [category, setCategory] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = () => {
    const url = category === 'all' ? '/api/skills' : `/api/skills?category=${category}`;
    fetch(url)
      .then(res => res.json())
      .then(data => setSkills(data.skills || []))
      .catch(() => setError('加载技能列表失败'));
  };

  useEffect(() => {
    fetchSkills();
  }, [category]);

  const handleInstall = async (skillId: string) => {
    setActionLoading(skillId);
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_id: skillId }),
      });
      if (res.ok) fetchSkills();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const handleUninstall = async (skillId: string) => {
    setActionLoading(skillId);
    try {
      const res = await fetch('/api/skills', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_id: skillId }),
      });
      if (res.ok) fetchSkills();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const categories = [
    { id: 'all', label: t('skills_page.all') },
    { id: 'security', label: t('skills_page.security') },
    { id: 'reliability', label: t('skills_page.reliability') },
  ];

  const skillNames: Record<string, { en: string; zh: string }> = {
    'basic_security': { en: 'Basic Security Check', zh: '基础安全检查' },
    'input_validation': { en: 'Input Validation', zh: '输入验证' },
    'error_handling': { en: 'Error Handling', zh: '错误处理' },
    'context_stability': { en: 'Context Stability', zh: '上下文稳定性' },
    'permission_boundary': { en: 'Permission Boundary', zh: '权限边界' },
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0b0f', color: '#ef4444' }}>
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0d0b0f' }}>
      {/* Header */}
      <nav className="flex justify-between items-center max-w-5xl mx-auto px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦞</span>
          <div>
            <div className="text-sm font-bold" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>{t('site.name')}</div>
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <Link href="/dashboard" className="text-sm hover:text-[#d4a853] transition" style={{ color: '#a89b8c' }}>
            {t('common.back')}
          </Link>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Main */}
      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold mb-8" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>
          {t('skills_page.title')}
        </h1>

        {/* Category Filter */}
        <div className="flex gap-3 mb-8">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="px-4 py-2 rounded text-sm transition"
              style={{
                background: category === cat.id ? 'rgba(212, 168, 83, 0.2)' : 'rgba(212, 168, 83, 0.05)',
                color: category === cat.id ? '#d4a853' : '#8a7b6b',
                border: `1px solid ${category === cat.id ? 'rgba(212, 168, 83, 0.3)' : 'rgba(212, 168, 83, 0.1)'}`,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Skills List */}
        {skills.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: '#8a7b6b' }}>{t('skills_page.no_skills')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <div key={skill.skill_id} className="p-5 rounded-lg border" style={{ background: 'rgba(212, 168, 83, 0.03)', borderColor: 'rgba(212, 168, 83, 0.15)' }}>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(212, 168, 83, 0.1)', color: '#d4a853' }}>
                    {skill.category}
                  </span>
                  {skill.installed && (
                    <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                      {t('skills_page.installed')}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-medium mb-2" style={{ color: '#a89b8c' }}>
                  {skillNames[skill.skill_id]?.[locale] || skill.name}
                </h3>
                <p className="text-xs mb-3" style={{ color: '#6a5b4b' }}>
                  {skill.description}
                </p>
                <div className="flex justify-between items-center">
                  <div className="flex gap-3">
                    <span className="text-xs" style={{ color: '#8a7b6b' }}>
                      ⭐ {skill.rating}
                    </span>
                    <span className="text-xs" style={{ color: '#8a7b6b' }}>
                      ↓ {skill.download_count}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    {skill.price === 0 ? (
                      <span className="text-xs" style={{ color: '#5a8f3d' }}>{t('skills_section.free')}</span>
                    ) : (
                      <span className="text-xs" style={{ color: '#d4a853' }}>${skill.price}</span>
                    )}
                    {skill.installed ? (
                      <button
                        onClick={() => handleUninstall(skill.skill_id)}
                        disabled={actionLoading === skill.skill_id}
                        className="text-xs px-3 py-1 rounded transition hover:opacity-80"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        {t('skills_page.uninstall')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleInstall(skill.skill_id)}
                        disabled={actionLoading === skill.skill_id}
                        className="text-xs px-3 py-1 rounded transition hover:opacity-80"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}
                      >
                        {t('skills_page.install')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
