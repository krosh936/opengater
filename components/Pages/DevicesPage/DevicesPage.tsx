'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './DevicesPage.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { fetchDeviceButtons, fetchDeviceTariff, setDeviceNumber, DeviceButtonOption, DeviceTariff, DeviceTariffResponse } from '@/lib/api';

interface DevicesPageProps {
  onBack?: () => void;
}

const FALLBACK_PLAN_NUMBERS = [2, 3, 5, 10];
const waitMs = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

type PriceValue = {
  amount: number;
  code?: string;
};

type ExtendedDeviceTariff = DeviceTariff & {
  discount_per_month?: number;
};

const parseLocalizedNumber = (raw: string): number | null => {
  let token = raw.replace(/\s+/g, '').trim();
  if (!token) return null;
  token = token.replace(/[^\d,.-]/g, '');
  if (!token) return null;

  const commaCount = (token.match(/,/g) || []).length;
  const dotCount = (token.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = token.lastIndexOf(',');
    const lastDot = token.lastIndexOf('.');
    if (lastComma > lastDot) {
      token = token.replace(/\./g, '').replace(',', '.');
    } else {
      token = token.replace(/,/g, '');
    }
  } else if (commaCount > 0) {
    const idx = token.lastIndexOf(',');
    const fractionLength = token.length - idx - 1;
    if (fractionLength > 0 && fractionLength <= 2) {
      token = token.replace(',', '.');
    } else {
      token = token.replace(/,/g, '');
    }
  } else if (dotCount > 1) {
    const idx = token.lastIndexOf('.');
    token = `${token.slice(0, idx).replace(/\./g, '')}${token.slice(idx)}`;
  }

  const parsed = Number(token);
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePriceValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;

    const withSuffix = text.match(/(-?[\d\s.,]+)\s*(RUB|USD|AMD|TG_STARS|\u20BD|\$|\u058F)\b/i);
    if (withSuffix?.[1]) {
      return parseLocalizedNumber(withSuffix[1]);
    }

    const withPrefix = text.match(/(?:RUB|USD|AMD|TG_STARS|\u20BD|\$|\u058F)\s*(-?[\d\s.,]+)/i);
    if (withPrefix?.[1]) {
      return parseLocalizedNumber(withPrefix[1]);
    }

    if (/[A-Za-z\u0400-\u04FF\u0530-\u058F]/.test(text)) {
      return null;
    }

    const matches = Array.from(text.matchAll(/-?[\d\s.,]+/g));
    if (!matches.length) return null;
    const parsedValues = matches
      .map((item) => parseLocalizedNumber(item[0]))
      .filter((num) => Number.isFinite(num));
    if (!parsedValues.length) return null;
    if (parsedValues.length === 1) return parsedValues[0];
    return parsedValues.reduce((best, current) =>
      Math.abs(current) > Math.abs(best) ? current : best
    );
  }
  return null;
};

const sanitizeDeviceInput = (value: string) => value.replace(/[^\d]/g, '');

const detectCurrencyCode = (text?: string | null): string | undefined => {
  if (!text) return undefined;
  const normalized = text.toUpperCase();
  if (/\b(RUB|RUR)\b/.test(normalized) || /[\u20BD]/.test(text)) return 'RUB';
  if (/\bUSD\b/.test(normalized) || /\$/.test(text)) return 'USD';
  if (/\bAMD\b/.test(normalized) || /[\u058F]/.test(text)) return 'AMD';
  if (/\bTG_STARS\b/.test(normalized)) return 'TG_STARS';
  return undefined;
};

const parsePriceFromButtonText = (text?: string | null): PriceValue | null => {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  const detectedCode = detectCurrencyCode(normalized);

  const suffixCode = normalized.match(/(-?[\d\s.,]+)\s*(RUB|USD|AMD|TG_STARS)\b/i);
  if (suffixCode?.[1]) {
    const parsed = parseLocalizedNumber(suffixCode[1]);
    if (parsed == null) return null;
    return { amount: parsed, code: suffixCode[2]?.toUpperCase() || detectedCode };
  }

  const prefixCode = normalized.match(/\b(RUB|USD|AMD|TG_STARS)\s*(-?[\d\s.,]+)/i);
  if (prefixCode?.[2]) {
    const parsed = parseLocalizedNumber(prefixCode[2]);
    if (parsed == null) return null;
    return { amount: parsed, code: prefixCode[1]?.toUpperCase() || detectedCode };
  }

  const suffixSymbol = normalized.match(/(-?[\d\s.,]+)\s*([\u20BD$\u058F])/);
  if (suffixSymbol?.[1]) {
    const parsed = parseLocalizedNumber(suffixSymbol[1]);
    if (parsed == null) return null;
    return { amount: parsed, code: detectedCode };
  }

  const prefixSymbol = normalized.match(/([\u20BD$\u058F])\s*(-?[\d\s.,]+)/);
  if (prefixSymbol?.[2]) {
    const parsed = parseLocalizedNumber(prefixSymbol[2]);
    if (parsed == null) return null;
    return { amount: parsed, code: detectedCode };
  }

  return null;
};

const normalizeTariffResponse = (data: DeviceTariffResponse | unknown, deviceNumber: number): ExtendedDeviceTariff | null => {
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
      parsePriceValue(record.monthly_price);
    const dailyRaw = parsePriceValue(record.tariff_per_day);
    const daily = dailyRaw != null && Number.isFinite(dailyRaw) && dailyRaw > 0 ? dailyRaw : 0;
    const derivedMonthly = daily > 0 ? daily * 30 : null;
    let monthly = monthlyRaw;
    if (monthly == null && derivedMonthly != null) {
      monthly = derivedMonthly;
    }
    if (monthly != null && derivedMonthly != null && monthly < derivedMonthly * 0.45) {
      // Protect against malformed payloads where monthly is parsed as device count.
      monthly = derivedMonthly;
    }
    if (monthly == null) {
      return null;
    }
    const explicitDiscount =
      parsePriceValue(record.discount_per_month) ??
      parsePriceValue(record.discount) ??
      parsePriceValue(record.savings) ??
      parsePriceValue(record.benefit) ??
      parsePriceValue(record.economy) ??
      parsePriceValue(record.discount_amount);
    return {
      device_number: Number(record.device_number ?? deviceNumber) || deviceNumber,
      tariff_per_day: Number.isFinite(daily) ? daily : 0,
      tariff_per_month: monthly,
      discount_per_month:
        explicitDiscount != null && Number.isFinite(explicitDiscount) && explicitDiscount > 0
          ? explicitDiscount
          : undefined,
    };
  }
  return null;
};

export default function DevicesPage({ onBack }: DevicesPageProps) {
  const { t, language } = useLanguage();
  const { user, isLoading, error, isAuthenticated, refreshUser } = useUser();
  const { formatCurrency, currency, currencies, currencyRefreshId } = useCurrency();
  const [plans, setPlans] = useState<DeviceButtonOption[]>([]);
  const [selectedDeviceNumber, setSelectedDeviceNumber] = useState<number | null>(null);
  const [tariffs, setTariffs] = useState<Record<number, ExtendedDeviceTariff>>({});
  const [customValue, setCustomValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const tariffInFlightRef = useRef<Set<number>>(new Set());
  const activeServerCurrencyCode = user?.currency?.code || currency.code;

  const formatTariff = (value: number, code?: string) => {
    const amount = Number(value) || 0;
    const targetCode = code || activeServerCurrencyCode;
    if (targetCode && targetCode !== currency.code) {
      const sourceCurrency = currencies.find((item) => item.code === targetCode);
      const precision = sourceCurrency?.rounding_precision ?? 2;
      const formatted = precision > 0 ? amount.toFixed(precision) : Math.round(amount).toString();
      return `${formatted} ${targetCode}`;
    }
    return formatCurrency(amount, { showCode: true, showSymbol: false });
  };

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.device_number - b.device_number),
    [plans]
  );

  const planPrices = useMemo(() => {
    const map: Record<number, PriceValue> = {};
    sortedPlans.forEach((plan) => {
      const parsed = parsePriceFromButtonText(plan.text);
      if (parsed != null && parsed.amount > 0) {
        map[plan.device_number] = parsed;
      }
    });
    return map;
  }, [sortedPlans]);

  const planLabels = useMemo(() => {
    const map: Record<number, string> = {};
    sortedPlans.forEach((plan) => {
      const raw = (plan.text || '').trim();
      if (!raw) return;
      const withoutBrackets = raw.replace(/\([^)]*\)/g, ' ');
      const cleaned = withoutBrackets
        .replace(/RUB|USD|AMD|RUR|TG_STARS|[\u20BD$\u058F]/gi, ' ')
        .replace(/\d+(?:[.,]\d+)?/g, ' ')
        .replace(/[%]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned) {
        map[plan.device_number] = cleaned;
      }
    });
    return map;
  }, [sortedPlans]);

  const tariffTargets = useMemo(() => {
    const targets = new Set<number>();
    const maybeAdd = (num: number | null | undefined) => {
      if (num == null || !Number.isFinite(num) || num <= 0) return;
      targets.add(num);
    };
    maybeAdd(selectedDeviceNumber);
    maybeAdd(user?.device_number);
    sortedPlans.forEach((plan) => {
      if (!planPrices[plan.device_number]) {
        maybeAdd(plan.device_number);
      }
    });
    return Array.from(targets);
  }, [sortedPlans, planPrices, selectedDeviceNumber, user?.device_number]);

  useEffect(() => {
    setTariffs({});
    tariffInFlightRef.current.clear();
  }, [currencyRefreshId, user?.currency?.code]);

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
      const expectedCode = user?.currency?.code || currency.code;
      const maxAttempts = 5;
      let data: DeviceButtonOption[] = [];
      let loaded = false;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const fetched = await fetchDeviceButtons(user.id);
          data = Array.isArray(fetched) ? fetched : [];
          const planCodes = data
            .map((item) => detectCurrencyCode(item.text))
            .filter((code): code is string => !!code);
          const codeCounts = new Map<string, number>();
          planCodes.forEach((code) => {
            codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
          });
          const dominantCode =
            Array.from(codeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || undefined;
          loaded = true;
          if (!dominantCode || dominantCode === expectedCode || attempt === maxAttempts - 1) {
            break;
          }
        } catch {
          loaded = false;
          break;
        }
        await waitMs(260 + attempt * 220);
      }
      if (!mounted) return;
      if (!loaded) {
        setPlans([]);
        setSelectedDeviceNumber(user?.device_number || FALLBACK_PLAN_NUMBERS[0]);
        return;
      }
      setPlans(data);
      const selected =
        data.find((item) => item.selected)?.device_number ||
        user.device_number ||
        FALLBACK_PLAN_NUMBERS[0];
      setSelectedDeviceNumber(selected);
    };
    loadPlans();
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.device_number, currency.code, user?.currency?.code, currencyRefreshId]);

  useEffect(() => {
    let mounted = true;
    const loadTariffs = async () => {
      if (!user?.id || !tariffTargets.length) return;
      const deviceNumbers = Array.from(new Set(tariffTargets)).filter((num) => !tariffs[num]);
      if (!deviceNumbers.length) return;
      const results = await Promise.all(
        deviceNumbers.map(async (num) => {
          if (tariffInFlightRef.current.has(num)) {
            return null;
          }
          tariffInFlightRef.current.add(num);
          try {
            const data = await fetchDeviceTariff(user.id, num);
            return [num, data] as const;
          } catch {
            return null;
          } finally {
            tariffInFlightRef.current.delete(num);
          }
        })
      );
      if (!mounted) return;
      const next: Record<number, ExtendedDeviceTariff> = { ...tariffs };
      let hasChanges = false;
      results.forEach((item) => {
        if (item) {
          const [num, data] = item;
          const normalized = normalizeTariffResponse(data, num);
          if (normalized) {
            const current = next[num];
            if (
              !current ||
              current.tariff_per_month !== normalized.tariff_per_month ||
              current.tariff_per_day !== normalized.tariff_per_day ||
              current.discount_per_month !== normalized.discount_per_month
            ) {
              next[num] = normalized;
              hasChanges = true;
            }
          }
        }
      });
      if (hasChanges) {
        setTariffs(next);
      }
    };
    loadTariffs();
    return () => {
      mounted = false;
    };
  }, [tariffTargets, user?.id, user?.currency?.code, currencyRefreshId, tariffs]);

  const selectedTariff = useMemo(() => {
    if (selectedDeviceNumber == null) return null;
    if (tariffs[selectedDeviceNumber]) return tariffs[selectedDeviceNumber];
    return null;
  }, [selectedDeviceNumber, tariffs]);

  const getDisplayedMonthlyPrice = (deviceNumber: number | null | undefined): PriceValue | null => {
    if (!deviceNumber) return null;
    const fromButtons = planPrices[deviceNumber];
    if (fromButtons && Number.isFinite(fromButtons.amount)) {
      return { amount: fromButtons.amount, code: fromButtons.code || activeServerCurrencyCode };
    }
    const fromTariff = tariffs[deviceNumber]?.tariff_per_month;
    if (typeof fromTariff === 'number' && Number.isFinite(fromTariff)) {
      return { amount: fromTariff, code: activeServerCurrencyCode };
    }
    if (fromButtons && Number.isFinite(fromButtons.amount)) return fromButtons;
    return null;
  };

  const discountValue = useMemo(() => {
    if (!selectedTariff || selectedDeviceNumber == null) return 0;
    const explicitDiscount = Number(selectedTariff.discount_per_month) || 0;
    if (explicitDiscount > 0) {
      return explicitDiscount;
    }
    const monthly = Number(selectedTariff.tariff_per_month) || 0;
    const daily = Number(selectedTariff.tariff_per_day) || 0;
    if (daily > 0 && monthly > 0) {
      const diffByDaily = daily * 30 - monthly;
      if (diffByDaily > 0) return diffByDaily;
    }
    return 0;
  }, [selectedTariff, selectedDeviceNumber]);
  const isDiscountTier = (selectedDeviceNumber ?? 0) >= 5;
  const discountPercent = isDiscountTier && discountValue > 0 ? 28 : 0;
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
              {getDisplayedMonthlyPrice(user?.device_number) != null
                ? formatTariff(
                    (getDisplayedMonthlyPrice(user?.device_number) as PriceValue).amount,
                    (getDisplayedMonthlyPrice(user?.device_number) as PriceValue).code
                  )
                : '...'}
            </div>
            <div className="price-period">{t('devices.per_month')}</div>
          </div>
        </div>
      </div>

      <div className="plans-grid">
        {(sortedPlans.length ? sortedPlans : FALLBACK_PLAN_NUMBERS.map((num) => ({
          device_number: num,
          text: String(num),
          selected: num === selectedDeviceNumber,
        }))).map((plan) => {
          const price = getDisplayedMonthlyPrice(plan.device_number);
          const isActive = selectedDeviceNumber === plan.device_number;
          const isPopular = plan.device_number === 3;
          const showSavings = plan.device_number >= 5;
          return (
            <div
              key={plan.device_number}
              className={`plan-card ${isActive ? 'selected' : ''} ${isPopular ? 'popular' : ''}`}
              onClick={() => handleSelectPlan(plan.device_number)}
            >
              {isPopular && <span className="plan-badge">{t('devices.popular')}</span>}
              <div className="plan-number">{plan.device_number}</div>
              <div className="plan-name">{planLabels[plan.device_number] || deviceLabel(plan.device_number)}</div>
              <div className="plan-footer">
                <span className="plan-price">{price != null ? formatTariff(price.amount, price.code) : '...'}</span>
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
          <span className="pricing-value pricing-savings">-{formatTariff(discountValue, activeServerCurrencyCode)}</span>
        </div>
        <div className="pricing-row">
          <span className="pricing-label pricing-total-label">{t('devices.total_monthly')}</span>
          <span className="pricing-value pricing-total">
            {getDisplayedMonthlyPrice(selectedDeviceNumber) != null
              ? formatTariff(
                  (getDisplayedMonthlyPrice(selectedDeviceNumber) as PriceValue).amount,
                  (getDisplayedMonthlyPrice(selectedDeviceNumber) as PriceValue).code
                )
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
    </div>
  );
}
