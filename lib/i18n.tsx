'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Locale = 'en' | 'zh';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// 翻译缓存
const translations: Record<Locale, Record<string, unknown>> = {
  en: {},
  zh: {},
};

// 加载翻译文件
async function loadTranslations(locale: Locale): Promise<Record<string, unknown>> {
  if (Object.keys(translations[locale]).length > 0) {
    return translations[locale];
  }
  try {
    const response = await fetch(`/locales/${locale}.json`);
    const data = await response.json();
    translations[locale] = data;
    return data;
  } catch (error) {
    console.error(`Failed to load translations for ${locale}:`, error);
    return {};
  }
}

// 获取嵌套对象的值
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return path;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return typeof current === 'string' ? current : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  // 初始化：从 localStorage 读取语言偏好
  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'zh')) {
      setLocaleState(savedLocale);
    }
    setIsLoaded(true);
  }, []);

  // 加载翻译
  useEffect(() => {
    if (isLoaded) {
      loadTranslations(locale);
    }
  }, [locale, isLoaded]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : 'en';
  };

  const t = (key: string): string => {
    return getNestedValue(translations[locale] as Record<string, unknown>, key);
  };

  if (!isLoaded) {
    return <>{children}</>;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
