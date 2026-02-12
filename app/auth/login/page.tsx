'use client'
import React, { useEffect, useRef, useState } from 'react';
import './AuthPage.css';
import { authUserById, createAuthUserFromTelegram, setUserToken, TelegramAuthPayload } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthPayload) => void;
  }
}

export default function LoginPage() {
  const { t } = useLanguage();
  const [emailInput, setEmailInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const telegramWidgetRef = useRef<HTMLDivElement>(null);
  const [telegramBot, setTelegramBot] = useState('kostik_chukcha_bot');

  const titleText = 'Добро пожаловать';
  const subtitleText = 'Вы можете использовать электронную почту\nили Telegram для входа или регистрации';
  const emailLabel = 'Адрес электронной почты';
  const submitText = 'Продолжить';
  const dividerText = 'или';
  const telegramText = 'Продолжить с Telegram';
  const tokenToggleText = 'Войти по токену';
  const tokenPlaceholder = 'Введите токен';
  const tokenButtonText = 'Войти';
  const [useTelegramWidget, setUseTelegramWidget] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const prevRootTheme = root.getAttribute('data-theme');
    const prevBodyTheme = body.getAttribute('data-theme');
    const hadAuthClass = body.classList.contains('auth-page');

    root.setAttribute('data-theme', 'light');
    body.setAttribute('data-theme', 'light');
    body.classList.add('auth-page');

    return () => {
      if (prevRootTheme !== null) {
        root.setAttribute('data-theme', prevRootTheme);
      } else {
        root.removeAttribute('data-theme');
      }
      if (prevBodyTheme !== null) {
        body.setAttribute('data-theme', prevBodyTheme);
      } else {
        body.removeAttribute('data-theme');
      }
      if (!hadAuthClass) {
        body.classList.remove('auth-page');
      }
    };
  }, []);

  useEffect(() => {
    window.onTelegramAuth = async (user) => {
      try {
        setError('');
        const token = await createAuthUserFromTelegram(user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_source', 'telegram');
        }
        setUserToken(token);
        window.location.href = '/';
      } catch (e) {
        setError(t('auth.telegram_error'));
      }
    };
  }, [t]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('tg')?.toLowerCase();
    // По умолчанию используем виджет. Фолбек — только если явно указан ?tg=fallback.
    setUseTelegramWidget(urlMode !== 'fallback');
    const botFromUrl = params.get('tg_bot');
    if (botFromUrl) {
      localStorage.setItem('telegram_login_bot', botFromUrl);
    }
    const storedBot = localStorage.getItem('telegram_login_bot');
    setTelegramBot(botFromUrl || storedBot || 'kostik_chukcha_bot');
  }, []);

  useEffect(() => {
    if (!useTelegramWidget) return;
    if (!telegramWidgetRef.current) return;
    telegramWidgetRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', telegramBot);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    telegramWidgetRef.current.appendChild(script);
    const fallbackTimer = window.setTimeout(() => {
      if (!telegramWidgetRef.current) return;
      const hasIframe = telegramWidgetRef.current.querySelector('iframe');
      if (!hasIframe) {
        setUseTelegramWidget(false);
      }
    }, 1500);
    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, [useTelegramWidget, telegramBot]);

  const handleTelegramFallback = () => {
    if (typeof window !== 'undefined') {
      window.open('https://t.me/opengater_vpn_bot', '_blank', 'noopener,noreferrer');
    }
  };

  const handleTokenLogin = () => {
    const value = tokenInput.trim();
    if (!value) {
      setError(t('auth.token_required'));
      return;
    }
    setUserToken(value);
    window.location.href = '/';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const value = emailInput.trim();
      if (!value) {
        setError(t('auth.token_required'));
        return;
      }
      if (/^\d+$/.test(value)) {
        const userId = Number(value);
        const token = await authUserById(userId);
        setUserToken(token);
        window.location.href = '/';
        return;
      }
      setUserToken(value);
      window.location.href = '/';
    } catch {
      setError(t('auth.login_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-module___8aEwW__main">
      <button
        className="page-module___8aEwW__closeBtn"
        aria-label="Close"
        onClick={() => {
          try {
            window.location.href = window.location.origin + '/';
          } catch {
            window.location.href = '/';
          }
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12"></path>
        </svg>
      </button>

      <div className="page-module___8aEwW__content">
        <div className="page-module___8aEwW__step">
          <h1 className="page-module___8aEwW__title">{titleText}</h1>
          <p className="page-module___8aEwW__subtitle">{subtitleText}</p>

          {error && <div className="page-module___8aEwW__error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="page-module___8aEwW__inputWrap">
              <input
                className="page-module___8aEwW__input"
                placeholder=" "
                autoComplete="email"
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
              />
              <label className="page-module___8aEwW__inputLabel">{emailLabel}</label>
            </div>
            <button type="submit" className="page-module___8aEwW__btn page-module___8aEwW__btnPrimary" disabled={!emailInput || isSubmitting}>
              <span className="page-module___8aEwW__btnText">{submitText}</span>
            </button>
          </form>

          <div className="page-module___8aEwW__divider">
            <span className="page-module___8aEwW__divLine"></span>
            <span className="page-module___8aEwW__divText">{dividerText}</span>
            <span className="page-module___8aEwW__divLine"></span>
          </div>

          <button
            type="button"
            className="page-module___8aEwW__btn page-module___8aEwW__btnOutline page-module___8aEwW__telegramBtn"
            onClick={useTelegramWidget ? undefined : handleTelegramFallback}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.787l3.019-14.228c.309-1.239-.473-1.8-1.282-1.432z"></path>
            </svg>
            {telegramText}
            {useTelegramWidget && <div ref={telegramWidgetRef} className="page-module___8aEwW__telegramWidget"></div>}
          </button>

          <div className="page-module___8aEwW__tokenToggle">
            <button
              type="button"
              className="page-module___8aEwW__linkBtn"
              onClick={() => setShowToken((prev) => !prev)}
            >
              {tokenToggleText}
            </button>
          </div>

          {showToken && (
            <div className="page-module___8aEwW__tokenWrap">
              <input
                className="page-module___8aEwW__tokenInput"
                placeholder={tokenPlaceholder}
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
              />
              <button type="button" className="page-module___8aEwW__linkBtn" onClick={handleTokenLogin}>
                {tokenButtonText}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
