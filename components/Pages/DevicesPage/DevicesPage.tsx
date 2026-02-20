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
  const { formatMoneyFrom, currencyRefreshId, currencies, currency, convertAmount } = useCurrency();
  const [plans, setPlans] = useState<DeviceButtonOption[]>([]);
  const [selectedDeviceNumber, setSelectedDeviceNumber] = useState<number | null>(null);
  const [tariffs, setTariffs] = useState<Record<number, DeviceTariff>>({});
  const [customValue, setCustomValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [rawButtons, setRawButtons] = useState<unknown>(null);
  const [rawTariffs, setRawTariffs] = useState<Record<number, unknown>>({});
  const [debugCurrencyInfo, setDebugCurrencyInfo] = useState<Record<string, string | null>>({});

  const baseCurrency = user?.currency || null;
  const rubCurrency = useMemo(() => {
    const rub = currencies.find((item) => item.code === 'RUB');
    if (rub) return rub;
    return {
      code: 'RUB',
      symbol: '\u20BD',
      rate: 1,
      rounding_precision: 0,
      id: 1,
      hidden: false,
    } as const;
  }, [currencies]);

  const extractButtonPrice = (text?: string | null): { value: number; code: string } | null => {
    if (!text) return null;
    const bracketMatch = text.match(/\(([^)]*)\)/);
    const source = bracketMatch?.[1] || text;
    const matches = Array.from(source.matchAll(/([0-9]+(?:[.,][0-9]+)?)/g));
    if (!matches.length) return null;
    const raw = matches[matches.length - 1][1];
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value)) return null;
    const normalized = text.toUpperCase();
    const hasRub = normalized.includes('RUB') || text.includes('\u20BD');
    const hasUsd = normalized.includes('USD') || text.includes('$');
    const hasAmd = normalized.includes('AMD') || text.includes('\u058F');
    if (hasRub) return { value, code: 'RUB' };
    if (hasUsd) return { value, code: 'USD' };
    if (hasAmd) return { value, code: 'AMD' };
    return null;
  };

  const isClose = (a: number, b: number, tolerance = 0.06) => {
    const delta = Math.abs(a - b);
    const denom = Math.max(Math.abs(b), 1);
    return delta / denom <= tolerance;
  };

  const tariffBaseCurrency = useMemo(() => {
    const lookupCurrency = (code: string) => currencies.find((item) => item.code === code) || null;
    for (const plan of plans) {
      const tariffValue = tariffs[plan.device_number]?.tariff_per_month;
      if (tariffValue == null) continue;
      const parsed = extractButtonPrice(plan.text);
      if (!parsed) continue;
      const buttonCurrency = lookupCurrency(parsed.code);
      if (!buttonCurrency) continue;
      if (isClose(Number(tariffValue), parsed.value)) {
        return buttonCurrency;
      }
      const convertedFromRub = convertAmount(Number(tariffValue), rubCurrency, buttonCurrency.code);
      if (isClose(convertedFromRub, parsed.value)) {
        return rubCurrency;
      }
    }
    if (baseCurrency) {
      const resolved = lookupCurrency(baseCurrency.code);
      if (resolved) return resolved;
    }
    return rubCurrency;
  }, [plans, tariffs, currencies, baseCurrency, convertAmount, rubCurrency]);

  const formatTariff = (value: number) => {
    const amount = Number(value) || 0;
    const sourceCurrency = tariffBaseCurrency || rubCurrency;
    if (!amount) return formatMoneyFrom(0, sourceCurrency);
    return formatMoneyFrom(amount, sourceCurrency);
  };

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
      const monthlyRaw =
        parsePriceValue(record.tariff_per_month) ??
        parsePriceValue(record.tariff) ??
        parsePriceValue(record.price) ??
        parsePriceValue(record.monthly) ??
        parsePriceValue(record.monthly_price) ??
        parsePriceValue(record.amount);
      const dailyRaw = parsePriceValue(record.tariff_per_day);
      const monthly = monthlyRaw ?? (dailyRaw != null ? dailyRaw * 30 : null);
      const daily = dailyRaw ?? 0;
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
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setDebugEnabled(params.has('debug'));
    const pendingCode = localStorage.getItem('currency_pending_code');
    setDebugCurrencyInfo({
      selected: currency.code,
      user: user?.currency?.code || null,
      pending: pendingCode,
      tariffBase: tariffBaseCurrency?.code || null,
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!debugEnabled) return;
    const pendingCode = localStorage.getItem('currency_pending_code');
    setDebugCurrencyInfo({
      selected: currency.code,
      user: user?.currency?.code || null,
      pending: pendingCode,
      tariffBase: tariffBaseCurrency?.code || null,
    });
  }, [currency.code, user?.currency?.code, debugEnabled, tariffBaseCurrency?.code]);

  useEffect(() => {
    setTariffs({});
    setRawTariffs({});
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
        setRawButtons(data);
        setPlans(Array.isArray(data) ? data : []);
        const selected =
          data.find((item) => item.selected)?.device_number ||
          user.device_number ||
          fallbackPlanNumbers[0];
        setSelectedDeviceNumber(selected);
      } catch {
        if (mounted) {
          setRawButtons({ error: 'fetchDeviceButtons_failed' });
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
      const nextRaw: Record<number, unknown> = {};
      results.forEach((item) => {
        if (item) {
          const [num, data] = item;
          nextRaw[num] = data;
          const normalized = normalizeTariffResponse(data, num);
          if (normalized) {
            next[num] = normalized;
          }
        }
      });
      setTariffs(next);
      setRawTariffs(nextRaw);
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
          setRawTariffs((prev) => ({ ...prev, [selectedDeviceNumber]: data }));
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
        setRawTariffs((prev) => ({ ...prev, [user.device_number as number]: data }));
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

  const baseTariffPerDevice = useMemo(() => {
    if (tariffs[2]?.tariff_per_month != null) {
      return tariffs[2].tariff_per_month;
    }
    const sortedKeys = Object.keys(tariffs)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (!sortedKeys.length) return null;
    return tariffs[sortedKeys[0]]?.tariff_per_month ?? null;
  }, [tariffs]);

  const currentUserTariff = useMemo(() => {
    if (!user?.device_number) return null;
    return tariffs[user.device_number] || null;
  }, [tariffs, user?.device_number]);

  const discountValue = useMemo(() => {
    if (!selectedTariff || selectedDeviceNumber == null) return 0;
    if (!baseTariffPerDevice) return 0;
    if (selectedDeviceNumber < 5) return 0;
    const baseTotal = baseTariffPerDevice * selectedDeviceNumber;
    const diff = baseTotal - selectedTariff.tariff_per_month;
    return diff > 0 ? diff : 0;
  }, [selectedTariff, selectedDeviceNumber, baseTariffPerDevice]);
  const discountPercent = discountValue > 0 ? 28 : 0;
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
                ? formatTariff(currentUserTariff.tariff_per_month, user?.device_number)
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
          const price = tariffs[plan.device_number]?.tariff_per_month ?? null;
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
                <span className="plan-price">{price != null ? formatTariff(price, plan.device_number) : '...'}</span>
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
          <span className="pricing-value pricing-savings">-{formatTariff(discountValue)}</span>
        </div>
        <div className="pricing-row">
          <span className="pricing-label pricing-total-label">{t('devices.total_monthly')}</span>
          <span className="pricing-value pricing-total">
            {selectedTariff && Number.isFinite(Number(selectedTariff.tariff_per_month))
              ? formatTariff(selectedTariff.tariff_per_month, selectedDeviceNumber)
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
          <span>{t('devices.info_privacy')}</span> {' \u2022 '} <a href="#" className="info-link">{t('devices.info_how_works')}</a>
        </div>
      </div>

      {debugEnabled && (
        <div className="devices-debug">
          <div className="devices-debug-title">Debug: currency</div>
          <pre>{JSON.stringify(debugCurrencyInfo, null, 2)}</pre>
          <div className="devices-debug-title">Debug: device buttons</div>
          <pre>{JSON.stringify(rawButtons, null, 2)}</pre>
          <div className="devices-debug-title">Debug: device tariffs</div>
          <pre>{JSON.stringify(rawTariffs, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
