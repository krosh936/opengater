'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserInfo, fetchUserInfo, getUserToken, removeUserToken, calculateDaysRemaining } from '@/lib/api';
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
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { setLanguage } = useLanguage();

  const loadUser = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    try {
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      
      const token = getUserToken();
      // No token means the user is signed out; avoid calling the API.
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
      // Sync UI language with backend preference when available.
      if (userData?.language) {
        const raw = userData.language.toLowerCase();
        const nextLang = raw.includes('ru') || raw.includes('рус')
          ? 'ru'
          : raw.includes('en') || raw.includes('eng')
          ? 'en'
          : raw.includes('am') || raw.includes('arm') || raw.includes('հայ')
          ? 'am'
          : null;
        if (nextLang) {
          setLanguage(nextLang);
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
      if (!silent && isAuthError) {
        setIsAuthenticated(false);
        setUser(null);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  const refreshUser = async (options?: { silent?: boolean }) => {
    // Silent refresh skips spinners to avoid UI flicker.
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
