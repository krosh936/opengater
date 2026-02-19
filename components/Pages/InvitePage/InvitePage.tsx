'use client'
import React, { useEffect, useMemo, useState } from 'react';
import './InvitePage.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { fetchReferredUsers, ReferredUser } from '@/lib/api';

interface InvitePageProps {
  onBack?: () => void;
}

const detectTelegram = () => {
  if (typeof window === 'undefined') return false;
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) return false;
  try {
    return tg.platform !== 'unknown' && tg.initDataUnsafe && Object.keys(tg.initDataUnsafe).length > 0;
  } catch {
    return false;
  }
};

export default function InvitePage({ onBack }: InvitePageProps) {
  const { t } = useLanguage();
  const { user, isLoading, error, isAuthenticated } = useUser();
  const { formatCurrency, currencyRefreshId, convertAmount, currency } = useCurrency();
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [isInTelegram, setIsInTelegram] = useState(false);

  useEffect(() => {
    setIsInTelegram(detectTelegram());
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!isAuthenticated) {
        setIsLoadingReferrals(false);
        return;
      }
      try {
        setIsLoadingReferrals(true);
        const data = await fetchReferredUsers();
        if (!mounted) return;
        setReferredUsers(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) {
          setReferredUsers([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingReferrals(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, currencyRefreshId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const referralLink = user?.bot_referral_link || user?.web_referral_link || '';

  const baseCurrency = user?.currency || null;
  const toDisplayCurrency = (value: number) =>
    formatCurrency(convertAmount(value, baseCurrency, currency.code), { showCode: true, showSymbol: false });
  const formatPrice = (price: number) => toDisplayCurrency(price);
  const displayPrice = (amount: number) => toDisplayCurrency(amount);

  const invitedCount = referredUsers.length;
  const connectedCount = referredUsers.filter((u) => u.connected === true).length;
  const totalEarned = referredUsers.reduce((sum, u) => sum + Number(u.amount || 0), 0);
  const totalEarnedDisplay = displayPrice(totalEarned);
  const progressPercent = invitedCount > 0 ? (connectedCount / invitedCount) * 100 : 0;

  const heroSubtitle = t('referral.hero_subtitle', { amount: formatPrice(50) });
  const shareButtonText = isInTelegram ? t('referral.share_telegram') : t('referral.copy_link');

  const showToast = (message: string) => {
    setToast(message);
  };

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  const handleCopy = async () => {
    if (!referralLink) {
      showToast(t('toast.link_loading'));
      return;
    }
    try {
      await copyToClipboard(referralLink);
      showToast(t('toast.link_copied'));
    } catch {
      showToast(t('toast.link_loading'));
    }
  };

  const handleShare = async () => {
    if (!referralLink) {
      showToast(t('toast.link_loading'));
      return;
    }

    if (isInTelegram && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      const shareMessage = t('referral.share_message', { bonus: formatPrice(150) });
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareMessage)}`;
      if (tg.openTelegramLink) {
        tg.openTelegramLink(shareUrl);
      } else {
        window.open(shareUrl, '_blank');
      }
      return;
    }

    try {
      await copyToClipboard(referralLink);
      showToast(t('toast.link_copied_share'));
    } catch {
      showToast(t('toast.link_loading'));
    }
  };

  if (isLoading) {
    return (
      <div className="invite-page loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="invite-page">
        <div className="error-container">
          <p style={{ color: 'red' }}>{t('common.error_prefix')}: {error}</p>
          <p>{t('common.check_token')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="invite-page">
        <div className="auth-required">
          <p>{t('common.auth_required')}</p>
          <p>{t('common.add_token')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-page">
      <header className="invite-mobile-header">
        <button className="back-button" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M5 12L12 19M5 12L12 5"></path>
          </svg>
        </button>
        <div className="header-title">{t('referral.header_title')}</div>
        <div className="header-spacer"></div>
      </header>

      <div className="hero-section">
        <div className="hero-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
        </div>
        <h1 className="hero-title">{t('referral.hero_title')}</h1>
        <p className="hero-subtitle">{heroSubtitle}</p>
      </div>

      <div className="earnings-block">
        <div className="earnings-header">{t('referral.total_earned')}</div>
        <div className="earnings-amount">
          {isLoadingReferrals ? '...' : totalEarnedDisplay}
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <div className="referral-stats">
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-dot invited"></span>
              <span>
                {t('referral.invited')} • <span className="stat-value">{isLoadingReferrals ? '...' : invitedCount}</span>
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-dot connected"></span>
              <span>
                {t('referral.connected')} • <span className="stat-value">{isLoadingReferrals ? '...' : connectedCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="code-section">
        <div className="code-label">{t('referral.your_link')}</div>
        <div className="code-display">
          {isLoading ? (
            <span className="loading-spinner"></span>
          ) : referralLink ? (
            <span className="link-text">{referralLink}</span>
          ) : (
            <span className="link-text">{t('referral.link_not_found')}</span>
          )}
          <svg className="copy-icon" onClick={handleCopy} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </div>
        <button className="share-button" type="button" onClick={handleShare}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          <span className="share-button-text">{shareButtonText}</span>
        </button>
      </div>

      <div className="referrals-section">
        <div className="section-header">
          <h2 className="section-title">{t('referral.referrals_title')}</h2>
          <span className="count-badge">{isLoadingReferrals ? '...' : invitedCount}</span>
        </div>
        <div className="referrals-card">
          {isLoadingReferrals ? (
            <div className="empty-state">...</div>
          ) : referredUsers.length === 0 ? (
            <div className="empty-state">{t('referral.no_referrals')}</div>
          ) : (
            <div className="referrals-list">
              {referredUsers.map((item, index) => {
                const initials = item.full_name
                  ? item.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                  : 'U';
                const isActive = item.connected === true;
                return (
                  <div className="referral-item" key={`${item.username || item.full_name || 'user'}-${index}`}>
                    <div className="referral-avatar">{initials}</div>
                    <div className="referral-info">
                      <div className="referral-name">{item.full_name || t('referral.user')}</div>
                      <div className="referral-username">{item.username ? `@${item.username}` : 'Telegram'}</div>
                    </div>
                    <div className="referral-status">
                      <div className={`status-badge ${isActive ? 'active' : 'pending'}`}>
                        {isActive ? t('referral.status_connected') : t('referral.status_invited')}
                      </div>
                      {isActive && item.amount ? (
                        <div className="referral-amount">+{displayPrice(Number(item.amount))}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
