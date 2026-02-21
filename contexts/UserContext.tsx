'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { UserInfo, fetchUserInfo, getUserToken, removeUserToken, calculateDaysRemaining, recoverUserTokenFromAuth } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface UserContextType {
  user: UserInfo | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  refreshUser: (options?: { silent?: boolean }) => Promise<void>;
  logout: () => void;
  daysRemaining: string;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { applyLanguageFromServer } = useLanguage();

  const loadUser = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    try {
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      
      const token = getUserToken();
      // Если токена нет — пользователь не авторизован, API не дергаем.
      if (!token) {
        if (!silent) {
          setIsAuthenticated(false);
          setUser(null);
        }
        return;
      }

      const userData = await fetchUserInfo();
      setUser(userData);
      setIsAuthenticated(true);
      setError(null);
      if (typeof window !== 'undefined' && userData?.id) {
        localStorage.setItem('user_id', String(userData.id));
      }
      // Синхронизируем язык UI с настройкой пользователя (если есть).
      if (userData?.language) {
        const raw = userData.language.toLowerCase();
        const nextLang = raw.includes('ru') || raw.includes('рус')
          ? 'ru'
          : raw.includes('en') || raw.includes('eng')
          ? 'en'
          : raw.includes('am') || raw.includes('arm') || raw.includes('հայ') || raw.includes('hy')
          ? 'am'
          : null;
        const pendingLang =
          typeof window !== 'undefined' ? localStorage.getItem('user_language_pending') : null;
        const pendingTsRaw =
          typeof window !== 'undefined' ? localStorage.getItem('user_language_pending_ts') : null;
        const pendingTs = pendingTsRaw ? Number(pendingTsRaw) : 0;
        const isPendingFresh =
          !!pendingLang && !!pendingTs && Date.now() - pendingTs < 60 * 1000;
        if (nextLang && !(isPendingFresh && pendingLang !== nextLang)) {
          applyLanguageFromServer(nextLang);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user_language_pending');
            localStorage.removeItem('user_language_pending_ts');
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С…';
      if (!silent) {
        setError(message);
      }
      const isAuthError =
        message.includes('РќРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅС‹Р№ С‚РѕРєРµРЅ') ||
        message.includes('401') ||
        message.includes('403');
      const isServerError =
        message.includes('Ошибка сервера: 5') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504');
      if (isAuthError) {
        try {
          const recovered = await recoverUserTokenFromAuth();
          if (recovered) {
            const userData = await fetchUserInfo();
            setUser(userData);
            setIsAuthenticated(true);
            setError(null);
            if (typeof window !== 'undefined' && userData?.id) {
              localStorage.setItem('user_id', String(userData.id));
            }
            return;
          }
        } catch {
          // Если восстановить токен не удалось — падаем дальше и выходим на логин.
        }
      }
      if (isAuthError || isServerError) {
        removeUserToken();
        setIsAuthenticated(false);
        setUser(null);
        if (typeof window !== 'undefined' && pathname && !pathname.startsWith('/auth')) {
          router.replace('/auth/login');
        }
      } else if (!silent) {
        // При 5xx оставляем пользователя авторизованным, чтобы не блокировать UI.
        setIsAuthenticated(true);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  const refreshUser = async (options?: { silent?: boolean }) => {
    // Silent-режим не показывает спиннер, чтобы избежать мигания UI.
    await loadUser(options);
  };

  const logout = () => {
    removeUserToken();
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  useEffect(() => {
    loadUser();
  }, []);

  const daysRemaining = user ? calculateDaysRemaining(user.expire) : '';

  return (
    <UserContext.Provider value={{
      user,
      isLoading,
      error,
      isAuthenticated,
      refreshUser,
      logout,
      daysRemaining,
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};
