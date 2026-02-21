'use client'
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { fetchLanguages, setUserLanguage } from '@/lib/api';
import ru from '@/locales/ru.json';
import en from '@/locales/en.json';
import am from '@/locales/am.json';

export type Language = 'ru' | 'en' | 'am';

export type LanguageOption = {
  code: Language;
  label: string;
  native: string;
  flag: string;
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  applyLanguageFromServer: (lang: Language) => void;
  toggleLanguage: () => void;
  languages: LanguageOption[];
  languageRefreshId: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'user_language';
const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const USER_ID_STORAGE_KEY = 'user_id';
const LANGUAGE_PENDING_KEY = 'user_language_pending';
const LANGUAGE_PENDING_TS_KEY = 'user_language_pending_ts';

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: 'ru', label: 'Русский', native: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', native: 'English', flag: '🇺🇸' },
  { code: 'am', label: 'Հայերեն', native: 'Հայերեն', flag: '🇦🇲' },
];

const LANGUAGE_MAP = DEFAULT_LANGUAGES.reduce((acc, lang) => {
  acc[lang.code] = lang;
  return acc;
}, {} as Record<Language, LanguageOption>);

const normalizeLanguageCode = (value?: string | null): Language | null => {
  if (!value) return null;
  const raw = value.toLowerCase();
  if (raw.includes('ru') || raw.includes('рус')) return 'ru';
  if (raw.includes('en') || raw.includes('eng')) return 'en';
  if (raw.includes('am') || raw.includes('arm') || raw.includes('հայ') || raw.includes('hy')) return 'am';
  return null;
};

// Формат списка языков отличается между эндпоинтами — приводим к единому виду.
const normalizeLanguageList = (input: unknown): LanguageOption[] => {
  if (!Array.isArray(input)) return DEFAULT_LANGUAGES;
  const byCode = new Map<Language, LanguageOption>();

  for (const item of input) {
    if (typeof item === 'string') {
      const code = normalizeLanguageCode(item);
      if (code && !byCode.has(code)) {
        byCode.set(code, LANGUAGE_MAP[code]);
      }
      continue;
    }

    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const rawCode = String(
        record.code ||
        record.language ||
        record.id ||
        record.short ||
        record.name ||
        ''
      );
      const code = normalizeLanguageCode(rawCode);
      if (!code) continue;

      const fallback = LANGUAGE_MAP[code];
      const label = typeof record.name === 'string' ? record.name : fallback.label;
      const native = typeof record.native === 'string' || typeof record.native_name === 'string'
        ? String(record.native || record.native_name)
        : fallback.native;
      if (!byCode.has(code)) {
        byCode.set(code, {
          code,
          label,
          native,
          flag: fallback.flag,
        });
      }
    }
  }

  if (byCode.size === 0) {
    return DEFAULT_LANGUAGES;
  }

  for (const fallback of DEFAULT_LANGUAGES) {
    if (!byCode.has(fallback.code)) {
      byCode.set(fallback.code, fallback);
    }
  }

  return Array.from(byCode.values());
};

const translations: Record<Language, Record<string, string>> = {
  ru: ru as Record<string, string>,
  en: en as Record<string, string>,
  am: am as Record<string, string>,
};

export const LanguageProvider = ({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (initialLanguage) return initialLanguage;
    if (typeof window === 'undefined') return 'ru';
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) || '';
    return normalizeLanguageCode(saved) || 'ru';
  });
  const [languages, setLanguages] = useState<LanguageOption[]>(DEFAULT_LANGUAGES);
  const [languageRefreshId, setLanguageRefreshId] = useState(0);

  const applyLanguageFromServer = (lang: Language) => {
    const changed = lang !== language;
    setLanguageState((prev) => (prev === lang ? prev : lang));
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      document.cookie = `${LANGUAGE_STORAGE_KEY}=${lang}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}`;

      const pending = localStorage.getItem(LANGUAGE_PENDING_KEY);
      if (pending === lang) {
        localStorage.removeItem(LANGUAGE_PENDING_KEY);
        localStorage.removeItem(LANGUAGE_PENDING_TS_KEY);
      }
    }
    if (changed) {
      setLanguageRefreshId((prev) => prev + 1);
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadLanguages = async () => {
      try {
        // Предпочитаем список из API, но при ошибках откатываемся к дефолтам.
        const apiLanguages = await fetchLanguages();
        if (!mounted) return;
        setLanguages(normalizeLanguageList(apiLanguages));
      } catch {
        if (!mounted) return;
        setLanguages(DEFAULT_LANGUAGES);
      }
    };
    loadLanguages();
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = (lang: Language) => {
    if (lang === language) return;
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      document.cookie = `${LANGUAGE_STORAGE_KEY}=${lang}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}`;
      localStorage.setItem(LANGUAGE_PENDING_KEY, lang);
      localStorage.setItem(LANGUAGE_PENDING_TS_KEY, String(Date.now()));
    }
    const storedUserId = typeof window !== 'undefined' ? localStorage.getItem(USER_ID_STORAGE_KEY) : null;
    const userId = storedUserId && /^\d+$/.test(storedUserId) ? Number(storedUserId) : null;
    setUserLanguage(lang, userId)
      .catch(() => {})
      .finally(() => setLanguageRefreshId((prev) => prev + 1));
  };

  const toggleLanguage = () => {
    const order: Language[] = ['ru', 'en', 'am'];
    const index = order.indexOf(language);
    const next = order[(index + 1) % order.length];
    setLanguage(next);
  };

  const t = useMemo(() => {
    const dict = translations[language];
    return (key: string, params?: Record<string, string | number>) => {
      // Если ключ не найден — берем RU как fallback и подставляем параметры.
      const template = dict[key] || translations.ru[key] || key;
      if (!params) return template;
      return Object.entries(params).reduce((acc, [k, v]) => {
        return acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }, template);
    };
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, applyLanguageFromServer, toggleLanguage, languages, languageRefreshId, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};



