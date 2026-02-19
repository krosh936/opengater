'use client'
import React, { useEffect, useMemo, useState } from 'react';
import './HistoryPage.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { fetchPaymentsHistory, PaymentHistoryItem } from '@/lib/api';

type PaymentGroup = {
  label: string;
  items: PaymentHistoryItem[];
};

const parseDateSafe = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (date: Date, language: string) => {
  const locale = language === 'ru' ? 'ru-RU' : language === 'am' ? 'hy-AM' : 'en-US';
  const formatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatter.format(date).replace(',', '');
};

const formatDateLabel = (date: Date, language: string, t: (key: string, options?: Record<string, unknown>) => string) => {
  const now = new Date();
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const diffDays = Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t('history.today');
  if (diffDays === 1) return t('history.yesterday');
  if (language === 'ru') {
    const months = [
      'январь',
      'февраль',
      'март',
      'апрель',
      'май',
      'июнь',
      'июль',
      'август',
      'сентябрь',
      'октябрь',
      'ноябрь',
      'декабрь',
    ];
    const day = date.getDate();
    const year = String(date.getFullYear()).slice(-2);
    return `${day} ${months[date.getMonth()]} ${year}`;
  }
  const locale = language === 'am' ? 'hy-AM' : 'en-US';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: '2-digit' }).format(date);
};

export default function HistoryPage() {
  const { t, language } = useLanguage();
  const { user, isLoading, error, isAuthenticated } = useUser();
  const { currency, currencies, convertAmount, formatNumber } = useCurrency();
  const [query, setQuery] = useState('');
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.id) {
        setIsPaymentsLoading(false);
        return;
      }
      try {
        setIsPaymentsLoading(true);
        const data = await fetchPaymentsHistory(user.id);
        if (mounted) {
          setPayments(Array.isArray(data) ? data : []);
        }
      } catch {
        if (mounted) setPayments([]);
      } finally {
        if (mounted) setIsPaymentsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const filteredPayments = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return payments;
    return payments.filter((payment) => {
      const paymentCurrency = payment.currency || '';
      const date = parseDateSafe(payment.created_at);
      const dateText = date ? formatDateTime(date, language) : '';
      const amountValue = payment.amount != null ? Math.abs(payment.amount) : 0;
      const fromCurrency =
        currencies.find((item) => item.code === (paymentCurrency || user?.currency?.code)) ||
        user?.currency ||
        null;
      const converted = convertAmount(amountValue, fromCurrency, currency.code);
      const amount = formatNumber(converted);
      const title = payment.title || '';
      const subtitle = payment.subtitle || '';
      const haystack = `${title} ${subtitle} ${amount} ${paymentCurrency} ${dateText}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [payments, query, language, currencies, currency.code, convertAmount, formatNumber, user?.currency]);

  const groupedPayments = useMemo<PaymentGroup[]>(() => {
    const groups = new Map<string, PaymentGroup>();
    const sorted = [...filteredPayments].sort((a, b) => {
      const aDate = parseDateSafe(a.created_at)?.getTime() || 0;
      const bDate = parseDateSafe(b.created_at)?.getTime() || 0;
      return bDate - aDate;
    });

    sorted.forEach((payment) => {
      const date = parseDateSafe(payment.created_at);
      const label = date ? formatDateLabel(date, language, t) : t('history.unknown_date');
      const key = date ? date.toDateString() : 'unknown';
      if (!groups.has(key)) {
        groups.set(key, { label, items: [] });
      }
      groups.get(key)?.items.push(payment);
    });

    return Array.from(groups.values());
  }, [filteredPayments, language, t]);

  if (isLoading) {
    return (
      <div className="history-page loading">
        <div className="loading-container">
          <span className="loading-spinner"></span>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="history-page">
        <div className="error-container">
          <p style={{ color: 'red' }}>{t('common.error_prefix')}: {error}</p>
          <p>{t('common.check_token')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="history-page">
        <div className="auth-required">
          <p>{t('common.auth_required')}</p>
          <p>{t('common.add_token')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="search-container">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="M21 21l-4.35-4.35"></path>
        </svg>
        <input
          type="text"
          className="search-input"
          id="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('history.search_placeholder')}
        />
      </div>

      <div className="filter-container" id="filter-container" />

      {isPaymentsLoading ? (
        <div className="history-empty">
          <span className="loading-spinner"></span>
          <p>{t('common.loading')}</p>
        </div>
      ) : groupedPayments.length === 0 ? (
        <div className="history-empty">
          <p className="history-empty-title">{t('history.empty_title')}</p>
          <p className="history-empty-subtitle">{t('history.empty_subtitle')}</p>
        </div>
      ) : (
        <div className="payments-container" id="payments-container">
          {groupedPayments.map((group) => (
            <div key={group.label} className="date-group">
              <div className="date-header">{group.label}</div>
              {group.items.map((payment) => {
                const amountValue = payment.amount ?? 0;
                const fromCurrency =
                  currencies.find((item) => item.code === (payment.currency || user?.currency?.code)) ||
                  user?.currency ||
                  null;
                const converted = convertAmount(Math.abs(amountValue), fromCurrency, currency.code);
                const amountLabel = `${amountValue >= 0 ? '+' : '-'}${formatNumber(converted)} ${currency.code}`.trim();
                const date = parseDateSafe(payment.created_at);
                return (
                  <div key={payment.id ?? `${payment.title}-${payment.created_at}-${amountLabel}`} className="payment-item">
                    <div className={`payment-icon ${amountValue >= 0 ? 'sent' : 'received'}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <polyline points={amountValue >= 0 ? '5 12 12 5 19 12' : '5 12 12 19 19 12'}></polyline>
                      </svg>
                    </div>
                    <div className="payment-info">
                      <div className="payment-title">{payment.title || t('history.default_title')}</div>
                      <div className="payment-subtitle">{payment.subtitle || t('history.default_subtitle')}</div>
                    </div>
                    <div className="payment-amount-container">
                      <div className={`payment-amount ${amountValue >= 0 ? 'positive' : 'negative'}`}>{amountLabel}</div>
                      <div className="payment-value">{date ? formatDateTime(date, language) : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
