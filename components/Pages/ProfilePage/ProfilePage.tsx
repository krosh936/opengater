'use client'
import React, { useEffect, useMemo, useState } from 'react';
import './ProfilePage.css';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';

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

export default function ProfilePage({ onBack }: ProfilePageProps) {
  const { user, isLoading, error, isAuthenticated } = useUser();
  const { t } = useLanguage();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const displayName = user?.full_name || user?.username || '---';
  const rawUsername = user?.username || '';
  const displayUsername =
    rawUsername && rawUsername !== displayName
      ? (rawUsername.includes('@') ? rawUsername : `@${rawUsername.replace(/^@/, '')}`)
      : '';
  const initials = getInitials(displayName);
  const uid = user?.id ? String(user.id) : '';
  const subscriptionActive = !!user && new Date(user.expire).getTime() > Date.now();

  const authInfo = useMemo(() => {
    const email = rawUsername.includes('@') ? rawUsername : '';
    const telegram = rawUsername && !rawUsername.includes('@')
      ? (rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`)
      : '';
    return { email, telegram };
  }, [rawUsername]);

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

      <h1 className="desktop-page-title">{t('profile.edit_profile')}</h1>

      <div className="profile-page-card">
        <div className="profile-page-header">
          <div className="profile-page-avatar">{initials}</div>
          <div className="profile-page-details">
            <div className="profile-page-name">{displayName}</div>
            <div className="profile-page-username" style={{ display: displayUsername ? 'block' : 'none' }}>
              {displayUsername}
            </div>
            <div className={`profile-page-sub ${subscriptionActive ? '' : 'expired'}`}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{subscriptionActive ? t('profile.subscription_active') : t('profile.subscription_expired')}</span>
            </div>
          </div>
        </div>
        <div className="profile-page-meta">
          <div className="profile-page-uid">
            ID <span>{uid}</span>
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
              <button type="button" className="auth-method-action" onClick={handleComingSoon}>
                {t('profile.change_email')}
              </button>
            </div>
          ) : (
            <button type="button" className="auth-method-row" onClick={handleComingSoon}>
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
          ) : null}
        </div>

        {!authInfo.telegram && (
          <button type="button" className="tg-link-btn" onClick={handleComingSoon}>
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
