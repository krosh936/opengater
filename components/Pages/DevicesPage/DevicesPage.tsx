'use client'
import React, { useEffect, useMemo, useState } from 'react';
import './DevicesPage.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { fetchDeviceButtons, fetchDeviceTariff, setDeviceNumber, DeviceButtonOption, DeviceTariff, DeviceTariffResponse } from '@/lib/api';

interface DevicesPageProps {
  onBack?: () => void;
}

export default function DevicesPage({ onBack }: DevicesPageProps) {
  const { t, language } = useLanguage();
  const { user, isLoading, error, isAuthenticated, refreshUser } = useUser();
  const { formatMoneyFrom, currencyRefreshId } = useCurrency();
  const [plans, setPlans] = useState<DeviceButtonOption[]>([]);
  const [selectedDeviceNumber, setSelectedDeviceNumber] = useState<number | null>(null);
  const [tariffs, setTariffs] = useState<Record<number, DeviceTariff>>({});
  const [customValue, setCustomValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);

  const baseCurrency = user?.currency || null;
  const formatCurrency = (value: number) => formatMoneyFrom(Number(value) || 0, baseCurrency);
  const parsePriceValue = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
      if (!cleaned) return null;
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const sanitizeDeviceInput = (value: string) => value.replace(/[^\d]/g, '');

  const normalizeTariffResponse = (data: DeviceTariffResponse | unknown, deviceNumber: number): DeviceTariff | null => {
    if (Array.isArray(data)) {
      const match = data.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const record = item as Record<string, unknown>;
        const num = parsePriceValue(record.device_number ?? record.deviceNumber);
        return num === deviceNumber;
      });
      if (match) {
        return normalizeTariffResponse(match, deviceNumber);
      }
    }
    if (typeof data === 'number') {
      return {
        device_number: deviceNumber,
        tariff_per_day: 0,
        tariff_per_month: data,
      };
    }
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const monthly =
        parsePriceValue(record.tariff_per_month) ??
        parsePriceValue(record.tariff) ??
        parsePriceValue(record.price) ??
        parsePriceValue(record.monthly) ??
        parsePriceValue(record.monthly_price) ??
        parsePriceValue(record.amount);
      const daily = parsePriceValue(record.tariff_per_day) ?? 0;
      if (monthly == null) {
        return null;
      }
      return {
        device_number: Number(record.device_number ?? deviceNumber) || deviceNumber,
        tariff_per_day: Number.isFinite(daily) ? daily : 0,
        tariff_per_month: monthly,
      };
    }
    return null;
  };
  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.device_number - b.device_number),
    [plans]
  );
  const fallbackPlanNumbers = [2, 3, 5, 10];
  const planNumbers = useMemo(() => {
    if (sortedPlans.length) {
      return sortedPlans.map((plan) => plan.device_number);
    }
    return fallbackPlanNumbers;
  }, [sortedPlans]);

  useEffect(() => {
    setTariffs({});
  }, [currencyRefreshId]);

  const deviceLabel = (count: number) => {
    if (language === 'en') return count === 1 ? t('devices.device_single') : t('devices.devices_plural');
    const last = count % 10;
    const lastTwo = count % 100;
    if (lastTwo < 11 || lastTwo > 14) {
      if (last === 1) return t('devices.device_one');
      if (last >= 2 && last <= 4) return t('devices.device_few');
    }
    return t('devices.devices_plural');
  };

  useEffect(() => {
    let mounted = true;
    const loadPlans = async () => {
      if (!user?.id) return;
      try {
        const data = await fetchDeviceButtons(user.id);
        if (!mounted) return;
        setPlans(Array.isArray(data) ? data : []);
        const selected =
          data.find((item) => item.selected)?.device_number ||
          user.device_number ||
          fallbackPlanNumbers[0];
        setSelectedDeviceNumber(selected);
      } catch {
        if (mounted) {
          setPlans([]);
          setSelectedDeviceNumber(user?.device_number || fallbackPlanNumbers[0]);
        }
      }
    };
    loadPlans();
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.device_number, currencyRefreshId]);

  useEffect(() => {
    let mounted = true;
    const loadTariffs = async () => {
      if (!user?.id || !planNumbers.length) return;
      const deviceNumbers = Array.from(new Set(planNumbers));
      const results = await Promise.all(
        deviceNumbers.map(async (num) => {
          try {
            const data = await fetchDeviceTariff(user.id, num);
            return [num, data] as const;
          } catch {
            return null;
          }
        })
      );
      if (!mounted) return;
      const next: Record<number, DeviceTariff> = {};
      results.forEach((item) => {
        if (item) {
          const [num, data] = item;
          const normalized = normalizeTariffResponse(data, num);
          if (normalized) {
            next[num] = normalized;
          }
        }
      });
      setTariffs(next);
    };
    loadTariffs();
    return () => {
      mounted = false;
    };
  }, [planNumbers, user?.id, currencyRefreshId]);

  useEffect(() => {
    if (!user?.id || selectedDeviceNumber == null) return;
    if (tariffs[selectedDeviceNumber]) return;
    let mounted = true;
    fetchDeviceTariff(user.id, selectedDeviceNumber)
      .then((data) => {
        if (mounted) {
          const normalized = normalizeTariffResponse(data, selectedDeviceNumber);
          if (normalized) {
            setTariffs((prev) => ({
              ...prev,
              [selectedDeviceNumber]: {
                ...normalized,
              },
            }));
          }
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [selectedDeviceNumber, user?.id, currencyRefreshId, tariffs]);

  useEffect(() => {
    if (!user?.id || !user?.device_number) return;
    if (tariffs[user.device_number]) return;
    let mounted = true;
    fetchDeviceTariff(user.id, user.device_number)
      .then((data) => {
        if (!mounted) return;
        const normalized = normalizeTariffResponse(data, user.device_number);
        if (normalized) {
          setTariffs((prev) => ({
            ...prev,
            [user.device_number as number]: normalized,
          }));
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.device_number, currencyRefreshId, tariffs]);

  const selectedTariff = useMemo(() => {
    if (selectedDeviceNumber == null) return null;
    if (tariffs[selectedDeviceNumber]) return tariffs[selectedDeviceNumber];
    return null;
  }, [selectedDeviceNumber, tariffs]);

  const selectedInlinePrice = useMemo(() => {
    if (selectedDeviceNumber == null) return null;
    const plan = sortedPlans.find((item) => item.device_number === selectedDeviceNumber);
    if (!plan) return null;
    const record = plan as Record<string, unknown>;
    return (
      parsePriceValue(record.tariff_per_month) ??
      parsePriceValue(record.tariff) ??
      parsePriceValue(record.price)
    );
  }, [selectedDeviceNumber, sortedPlans, parsePriceValue]);

  const currentUserTariff = useMemo(() => {
    if (!user?.device_number) return null;
    return tariffs[user.device_number] || null;
  }, [tariffs, user?.device_number]);

  const currentPlanInlinePrice = useMemo(() => {
    if (!user?.device_number) return null;
    const plan = sortedPlans.find((item) => item.device_number === user.device_number);
    if (!plan) return null;
    const record = plan as Record<string, unknown>;
    return (
      parsePriceValue(record.tariff_per_month) ??
      parsePriceValue(record.tariff) ??
      parsePriceValue(record.price)
    );
  }, [sortedPlans, user?.device_number, parsePriceValue]);

  const discountPercent = 0;
  const discountValue = 0;
  const showSummary = customValue.trim().length > 0;

  useEffect(() => {
    let summaryTimer: number | undefined;
    let actionsTimer: number | undefined;

    if (showSummary) {
      setSummaryVisible(false);
      setActionsVisible(false);
      summaryTimer = window.setTimeout(() => setSummaryVisible(true), 100);
      actionsTimer = window.setTimeout(() => setActionsVisible(true), 200);
    } else {
      setSummaryVisible(false);
      setActionsVisible(false);
    }

    return () => {
      if (summaryTimer) window.clearTimeout(summaryTimer);
      if (actionsTimer) window.clearTimeout(actionsTimer);
    };
  }, [showSummary]);
  const handleSelectPlan = (deviceNumber: number) => {
    setSelectedDeviceNumber(deviceNumber);
    setCustomValue('');
  };

  const handleCustomInput = (value: string) => {
    const sanitized = sanitizeDeviceInput(value);
    setCustomValue(sanitized);
    if (!sanitized) return;
    const parsed = Number(sanitized);
    if (Number.isFinite(parsed) && parsed >= 2) {
      setSelectedDeviceNumber(parsed);
    }
  };

  useEffect(() => {
    if (!customValue) return;
    const parsed = Number(customValue);
    if (!Number.isFinite(parsed)) return;
    if (parsed < 2) {
      const timer = window.setTimeout(() => {
        setCustomValue('2');
        setSelectedDeviceNumber(2);
      }, 400);
      return () => window.clearTimeout(timer);
    }
    if (parsed > 100) {
      setCustomValue('100');
      setSelectedDeviceNumber(100);
    }
    return undefined;
  }, [customValue]);

  const handleUpdate = async () => {
    if (!user?.id || selectedDeviceNumber == null) return;
    setIsUpdating(true);
    try {
      await setDeviceNumber(user.id, selectedDeviceNumber);
      await refreshUser();
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="devices-page loading">
        <div className="loading-container">
          <span className="loading-spinner" aria-hidden="true"></span>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="devices-page">
        <div className="error-container">
          <p style={{ color: 'red' }}>{t('common.error_prefix')}: {error}</p>
          <p>{t('common.check_token')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="devices-page">
        <div className="auth-required">
          <p>{t('common.auth_required')}</p>
          <p>{t('common.add_token')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="devices-page">
      <header className="devices-mobile-header">
        <button className="back-button" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M5 12L12 19M5 12L12 5"></path>
          </svg>
        </button>
        <div className="header-title">{t('devices.page_title')}</div>
        <div className="header-spacer"></div>
      </header>

      <div className="hero-section">
        <div className="hero-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <circle cx="12" cy="18" r="1"></circle>
          </svg>
        </div>
        <h1 className="hero-title">{t('devices.hero_title')}</h1>
        <p className="hero-subtitle">{t('devices.hero_subtitle')}</p>
      </div>

      <div className="current-status">
        <div className="status-label">{t('devices.current_tariff')}</div>
        <div className="status-content">
          <span className="status-devices">
            {user?.device_number ?? 0} {deviceLabel(user?.device_number ?? 0)}
          </span>
          <div className="status-price">
            <div className="price-value">
              {currentUserTariff && Number.isFinite(Number(currentUserTariff.tariff_per_month))
                ? formatCurrency(currentUserTariff.tariff_per_month)
                : currentPlanInlinePrice != null
                  ? formatCurrency(currentPlanInlinePrice)
                  : '...'}
            </div>
            <div className="price-period">{t('devices.per_month')}</div>
          </div>
        </div>
      </div>

      <div className="plans-grid">
        {(sortedPlans.length ? sortedPlans : fallbackPlanNumbers.map((num) => ({
          device_number: num,
          text: String(num),
          selected: num === selectedDeviceNumber,
        }))).map((plan) => {
          const planRecord = plan as Record<string, unknown>;
          const inlinePrice =
            parsePriceValue(planRecord.tariff_per_month) ??
            parsePriceValue(planRecord.tariff) ??
            parsePriceValue(planRecord.price);
          const price = tariffs[plan.device_number]?.tariff_per_month ?? inlinePrice;
          const isActive = selectedDeviceNumber === plan.device_number;
          const isPopular = plan.device_number === 3;
          const showSavings = plan.device_number === 5 || plan.device_number === 10;
          return (
            <div
              key={plan.device_number}
              className={`plan-card ${isActive ? 'selected' : ''} ${isPopular ? 'popular' : ''}`}
              onClick={() => handleSelectPlan(plan.device_number)}
            >
              {isPopular && <span className="plan-badge">{t('devices.popular')}</span>}
              <div className="plan-number">{plan.device_number}</div>
              <div className="plan-name">{deviceLabel(plan.device_number)}</div>
              <div className="plan-footer">
                <span className="plan-price">{price != null ? formatCurrency(price) : '...'}</span>
                {showSavings && <span className="plan-savings">{t('devices.savings_28')}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="custom-section">
        <label className="custom-label">{t('devices.custom_label')}</label>
        <input
          type="text"
          className="custom-input"
          placeholder={t('devices.custom_placeholder')}
          inputMode="numeric"
          pattern="[0-9]*"
          value={customValue}
          onChange={(event) => handleCustomInput(event.target.value)}
        />
      </div>

      <div className={`pricing-summary ${summaryVisible ? 'visible' : ''}`}>
        <div className="pricing-title">{t('devices.pricing_title')}</div>
        <div className="pricing-row">
          <span className="pricing-label">{t('devices.selected_devices')}</span>
          <span className="pricing-value">{selectedDeviceNumber ?? '-'}</span>
        </div>
        <div className="pricing-row" style={{ display: discountPercent ? 'flex' : 'none' }}>
          <span className="pricing-label">{t('devices.discount_28')}</span>
          <span className="pricing-value pricing-savings">-{formatCurrency(discountValue)}</span>
        </div>
        <div className="pricing-row">
          <span className="pricing-label pricing-total-label">{t('devices.total_monthly')}</span>
          <span className="pricing-value pricing-total">
            {selectedTariff && Number.isFinite(Number(selectedTariff.tariff_per_month))
              ? formatCurrency(selectedTariff.tariff_per_month)
              : selectedInlinePrice != null
                ? formatCurrency(selectedInlinePrice)
                : '...'}
          </span>
        </div>
      </div>

      <div className={`bottom-actions ${actionsVisible ? 'visible' : ''}`}>
        <button className="action-button" onClick={handleUpdate} disabled={isUpdating || selectedDeviceNumber == null}>
          <span>{t('devices.update_button')}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <div className="info-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>{t('devices.info_privacy')}</span> • <a href="#" className="info-link">{t('devices.info_how_works')}</a>
        </div>
      </div>
    </div>
  );
}
