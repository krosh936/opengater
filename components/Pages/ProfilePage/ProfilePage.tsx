'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './ProfilePage.css';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchAuthProfile, linkTelegramToAuth, TelegramAuthPayload } from '@/lib/api';
import { AUTH_POPUP_ORIGIN } from '@/lib/appConfig';

interface ProfilePageProps {
  onBack?: () => void;
}

const getInitials = (value: string) => {
  if (!value) return '?';
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
};

const formatTelegramDisplay = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d+$/.test(trimmed)) return '';
  if (trimmed.startsWith('@')) return trimmed;
  const handleLike = /^(?=.*[a-zA-Z_])[a-zA-Z0-9_]{3,}$/.test(trimmed);
  return handleLike ? `@${trimmed}` : trimmed;
};

export default function ProfilePage({ onBack }: ProfilePageProps) {
  const { user, isLoading, error, isAuthenticated, refreshUser } = useUser();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const [toast, setToast] = useState<string | null>(null);
  const [linkedEmail, setLinkedEmail] = useState<string | null>(null);
  const [linkedTelegram, setLinkedTelegram] = useState<string | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const popupOrigin = AUTH_POPUP_ORIGIN;

  const getAuthToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_access_token') || localStorage.getItem('access_token');
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const rawUsername = user?.username || '';
  const authInfo = useMemo(() => {
    const email = linkedEmail || (rawUsername.includes('@') ? rawUsername : '');
    const telegramSource =
      linkedTelegram ||
      (telegramLinked && rawUsername && !rawUsername.includes('@') ? rawUsername : '');
    const telegram = telegramSource ? formatTelegramDisplay(telegramSource) : '';
    return { email, telegram, telegramLinked };
  }, [linkedEmail, linkedTelegram, rawUsername, telegramLinked]);
  const displayName = user?.full_name || user?.username || authInfo.email || authInfo.telegram || '---';
  const displayUsername =
    rawUsername && rawUsername !== displayName
      ? (rawUsername.includes('@') ? rawUsername : `@${rawUsername.replace(/^@/, '')}`)
      : '';
  const initials = getInitials(displayName);
  const uid = user?.id ? String(user.id) : '';
  const subscriptionActive = !!user && new Date(user.expire).getTime() > Date.now();

  const loadAuthProfile = async () => {
    if (typeof window === 'undefined') return;
    const token = getAuthToken();
    if (!token) {
      setLinkedEmail(null);
      setLinkedTelegram(null);
      setTelegramLinked(false);
      return;
    }
    const profile = await fetchAuthProfile(token);
    if (!profile) {
      return;
    }
    setLinkedEmail(profile.email || null);
    setLinkedTelegram(profile.telegram || null);
    setTelegramLinked(!!profile.telegramLinked || !!profile.telegram);
  };

  useEffect(() => {
    loadAuthProfile().catch(() => {});
    const handleFocus = () => {
      loadAuthProfile().catch(() => {});
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== popupOrigin) return;
      if (!event.data || typeof event.data !== 'object') return;
      const data = event.data as { type?: string };

      if (data.type === 'request_link_token') {
        const token = getAuthToken();
        if (!token) {
          setToast(t('profile.link_email_requires_auth'));
          return;
        }
        // Отправляем токен в popup, чтобы завершить привязку email.
        (event.source as Window | null)?.postMessage({ type: 'link_token', token }, event.origin);
        return;
      }

      if (data.type === 'telegram_link_data' && (data as { user?: TelegramAuthPayload }).user) {
        const token = getAuthToken();
        if (!token) {
          setToast(t('profile.link_telegram_requires_auth'));
          return;
        }
        const payload = (data as { user: TelegramAuthPayload }).user;
        const applyTelegramLink = (user?: TelegramAuthPayload) => {
          const username = user?.username ? user.username.replace(/^@/, '') : '';
          const display = username || user?.first_name || '';
          setTelegramLinked(true);
          setLinkedTelegram(display || null);
        };
        linkTelegramToAuth(token, payload)
          .then(() => {
            applyTelegramLink(payload);
            setToast(t('profile.telegram_linked'));
            refreshUser({ silent: true }).catch(() => {});
            loadAuthProfile().catch(() => {});
            if (popupRef.current && !popupRef.current.closed) {
              popupRef.current.close();
            }
          })
          .catch((err: unknown) => {
            const status = (err as { status?: number })?.status;
            if (status === 409) {
              applyTelegramLink(payload);
              setToast(t('profile.telegram_linked'));
              refreshUser({ silent: true }).catch(() => {});
              loadAuthProfile().catch(() => {});
              return;
            }
            const message = err instanceof Error ? err.message : t('common.error_prefix');
            setToast(message);
          });
        return;
      }

      if (data.type === 'email_linked') {
        setToast(t('profile.email_linked_success'));
        refreshUser({ silent: true }).catch(() => {});
        loadAuthProfile().catch(() => {});
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshUser, t]);

  const openEmailLinkPopup = (mode: 'add' | 'change') => {
    const token = getAuthToken();
    if (!token) {
      setToast(t('profile.link_email_requires_auth'));
      return;
    }

    const lang = language === 'am' ? 'hy' : language;
    const url = new URL(popupOrigin);
    url.searchParams.set('link_email', '1');
    url.searchParams.set('user_name', displayName || 'User');
    url.searchParams.set('theme', theme || 'light');
    url.searchParams.set('lang', lang);
    if (mode === 'change') {
      url.searchParams.set('change', '1');
    }

    popupRef.current = window.open(
      url.toString(),
      'opengater_email_link',
      'width=520,height=720,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes'
    );
    if (!popupRef.current) {
      setToast(t('profile.popup_blocked'));
    }
  };

  const openTelegramLinkPopup = () => {
    const token = getAuthToken();
    if (!token) {
      setToast(t('profile.link_telegram_requires_auth'));
      return;
    }

    const lang = language === 'am' ? 'hy' : language;
    const url = new URL(popupOrigin);
    url.searchParams.set('link_telegram', '1');
    url.searchParams.set('user_name', displayName || 'User');
    url.searchParams.set('theme', theme || 'light');
    url.searchParams.set('lang', lang);

    popupRef.current = window.open(
      url.toString(),
      'opengater_telegram_link',
      'width=520,height=720,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes'
    );
    if (!popupRef.current) {
      setToast(t('profile.popup_blocked'));
    }
  };

  const copyUid = async () => {
    if (!uid) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(uid);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = uid;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setToast(t('profile.copy_id'));
    } catch {
      setToast(t('common.error_prefix'));
    }
  };

  const handleComingSoon = () => {
    setToast(t('common.in_development'));
  };

  if (isLoading) {
    return (
      <div className="profile-page loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="profile-page">
        <div className="error-container">
          <p style={{ color: 'red' }}>{t('common.error_prefix')}: {error}</p>
          <p>{t('common.check_token')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="profile-page">
        <div className="auth-required">
          <p>{t('common.auth_required')}</p>
          <p>{t('common.add_token')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-mobile-header">
        <button className="back-button" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M5 12L12 19M5 12L12 5"></path>
          </svg>
        </button>
        <div className="header-title">{t('profile.edit_profile')}</div>
        <div className="header-spacer"></div>
      </header>

      <div className="profile-page-card">
        <div className="profile-page-header">
          <div className="profile-page-avatar">{initials}</div>
          <div className="profile-page-details">
            <div className="profile-page-name">{displayName}</div>
            <div className="profile-page-username" style={{ display: displayUsername ? 'block' : 'none' }}>
              {displayUsername}
            </div>
            <div className={`profile-page-sub ${subscriptionActive ? '' : 'expired'}`}>
              <span className="profile-status-dot" />
              <span>{subscriptionActive ? t('profile.subscription_active') : t('profile.subscription_expired')}</span>
            </div>
          </div>
        </div>
        <div className="profile-page-meta">
          <div className="profile-page-uid">
            ID · <span>{uid}</span>
            <button className="copy-uid-btn" onClick={copyUid} disabled={!uid}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="profile-section-label">{t('profile.auth_methods')}</div>
      <div className="profile-auth-methods">
        <div className="auth-methods-card">
          {authInfo.email ? (
            <div className="auth-method-row">
              <div className="auth-method-icon email-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <div className="auth-method-info">
                <span className="auth-method-label">Email</span>
                <span className="auth-method-value">{authInfo.email}</span>
              </div>
              <button type="button" className="auth-method-action" onClick={() => openEmailLinkPopup('change')}>
                {t('profile.change_email')}
              </button>
            </div>
          ) : (
            <button type="button" className="auth-method-row" onClick={() => openEmailLinkPopup('add')}>
              <div className="auth-method-icon email-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <div className="auth-method-info">
                <span className="auth-method-value muted">{t('profile.add_email_btn')}</span>
              </div>
              <svg className="auth-method-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {authInfo.telegram ? (
            <div className="auth-method-row">
              <div className="auth-method-icon tg-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.787l3.019-14.228c.309-1.239-.473-1.8-1.282-1.432z" />
                </svg>
              </div>
              <div className="auth-method-info">
                <span className="auth-method-label">Telegram</span>
                <span className="auth-method-value">{authInfo.telegram}</span>
              </div>
            </div>
          ) : authInfo.telegramLinked ? (
            <div className="auth-method-row">
              <div className="auth-method-icon tg-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.787l3.019-14.228c.309-1.239-.473-1.8-1.282-1.432z" />
                </svg>
              </div>
              <div className="auth-method-info">
                <span className="auth-method-label">Telegram</span>
                <span className="auth-method-value muted">{t('profile.telegram_linked')}</span>
              </div>
            </div>
          ) : null}
        </div>

        {!authInfo.telegramLinked && !authInfo.telegram && (
          <button type="button" className="tg-link-btn" onClick={openTelegramLinkPopup}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.787l3.019-14.228c.309-1.239-.473-1.8-1.282-1.432z" />
            </svg>
            {t('profile.add_telegram')}
          </button>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
