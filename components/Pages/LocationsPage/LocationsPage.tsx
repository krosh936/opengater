'use client'
import React, { useEffect, useMemo, useState } from 'react';
import './LocationsPage.css';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { fetchAvailableLocations, fetchDeviceTariff, fetchLocationsTariff, updateLocations, LocationItem, DeviceTariffResponse } from '@/lib/api';

interface LocationsPageProps {
  onBack?: () => void;
}

type LocationLocale = { name: string; description?: string };
type LocationLocales = Partial<Record<'ru' | 'en' | 'am', LocationLocale>>;

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const extractMonthlyTariff = (payload: DeviceTariffResponse | unknown): number | null => {
  if (typeof payload === 'number' && Number.isFinite(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const monthly =
    parseNumber(record.tariff_per_month) ??
    parseNumber(record.tariff) ??
    parseNumber(record.price) ??
    parseNumber(record.monthly) ??
    parseNumber(record.monthly_price);
  if (monthly != null) return monthly;
  const daily = parseNumber(record.tariff_per_day);
  if (daily != null && daily > 0) return daily * 30;
  return null;
};

const LOCATION_LOCALIZED: Record<number, LocationLocales> = {
  2: {
    en: { name: 'Netherlands', description: 'Amsterdam' },
    ru: { name: '\u041d\u0438\u0434\u0435\u0440\u043b\u0430\u043d\u0434\u044b', description: '\u0410\u043c\u0441\u0442\u0435\u0440\u0434\u0430\u043c' },
    am: { name: '\u0546\u056b\u0564\u0565\u057c\u056c\u0561\u0576\u0564\u0576\u0565\u0580', description: '\u0531\u0574\u057d\u057f\u0565\u0580\u0564\u0561\u0574' },
  },
  3: {
    en: { name: 'USA', description: 'New Jersey' },
    ru: { name: '\u0421\u0428\u0410', description: '\u041d\u044c\u044e-\u0414\u0436\u0435\u0440\u0441\u0438' },
    am: { name: '\u0531\u0544\u0546', description: '\u0546\u0575\u0578\u0582 \u054b\u0565\u0580\u057d\u056b' },
  },
  4: {
    en: { name: 'Germany', description: 'Frankfurt' },
    ru: { name: '\u0413\u0435\u0440\u043c\u0430\u043d\u0438\u044f', description: '\u0424\u0440\u0430\u043d\u043a\u0444\u0443\u0440\u0442' },
    am: { name: '\u0533\u0565\u0580\u0574\u0561\u0576\u056b\u0561', description: '\u0556\u0580\u0561\u0576\u056b\u0584\u0586\u0578\u0582\u0580\u057f' },
  },
  5: {
    en: { name: 'Russia', description: 'Saint Petersburg' },
    ru: { name: '\u0420\u043e\u0441\u0441\u0438\u044f', description: '\u0421\u0430\u043d\u043a\u0442-\u041f\u0435\u0442\u0435\u0440\u0431\u0443\u0440\u0433' },
    am: { name: '\u054c\u0578\u0582\u057d\u0561\u057d\u057f\u0561\u0576', description: '\u054d\u0561\u0576\u056f\u057f \u054a\u0565\u057f\u0565\u0580\u0562\u0578\u0582\u0580\u0563' },
  },
  9: {
    en: { name: 'Turkey', description: 'Istanbul' },
    ru: { name: '\u0422\u0443\u0440\u0446\u0438\u044f', description: '\u0421\u0442\u0430\u043c\u0431\u0443\u043b' },
    am: { name: '\u0539\u0578\u0582\u0580\u0584\u056b\u0561', description: '\u054d\u057f\u0561\u0574\u0562\u0578\u0582\u056c' },
  },
  10: {
    en: { name: 'Kazakhstan', description: 'Almaty' },
    ru: { name: '\u041a\u0430\u0437\u0430\u0445\u0441\u0442\u0430\u043d', description: '\u0410\u043b\u043c\u0430\u0442\u044b' },
    am: { name: '\u0542\u0561\u0566\u0561\u056d\u057d\u057f\u0561\u0576', description: '\u0531\u056c\u0574\u0561\u0569\u056b' },
  },
  11: {
    en: { name: 'France', description: 'Paris' },
    ru: { name: '\u0424\u0440\u0430\u043d\u0446\u0438\u044f', description: '\u041f\u0430\u0440\u0438\u0436' },
    am: { name: '\u0556\u0580\u0561\u0576\u057d\u056b\u0561', description: '\u0553\u0561\u0580\u056b\u0566' },
  },
  14: {
    en: { name: 'Netherlands Premium', description: 'Amsterdam' },
    ru: { name: '\u041d\u0438\u0434\u0435\u0440\u043b\u0430\u043d\u0434\u044b Premium', description: '\u0410\u043c\u0441\u0442\u0435\u0440\u0434\u0430\u043c' },
    am: { name: '\u0546\u056b\u0564\u0565\u057c\u056c\u0561\u0576\u0564\u0576\u0565\u0580 Premium', description: '\u0531\u0574\u057d\u057f\u0565\u0580\u0564\u0561\u0574' },
  },
  15: {
    en: { name: 'USA', description: 'Miami' },
    ru: { name: '\u0421\u0428\u0410', description: '\u041c\u0430\u0439\u0430\u043c\u0438' },
    am: { name: '\u0531\u0544\u0546', description: '\u0544\u0561\u0575\u0561\u0574\u056b' },
  },
};

export default function LocationsPage({ onBack }: LocationsPageProps) {
  const { user, isLoading, error, isAuthenticated } = useUser();
  const { language, t, languageRefreshId } = useLanguage();
  const { formatCurrency, currency, currencies, currencyRefreshId } = useCurrency();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocationsLoading, setIsLocationsLoading] = useState(true);
  const [baseMonthlyPrice, setBaseMonthlyPrice] = useState<number | null>(null);
  const [serverTotalMonthly, setServerTotalMonthly] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.id) {
        setIsLocationsLoading(false);
        return;
      }
      try {
        setIsLocationsLoading(true);
        const data = await fetchAvailableLocations(
          user.id,
          language,
          user?.currency?.code || currency.code,
          user?.currency?.code
        );
        if (mounted) {
          const filtered = Array.isArray(data) ? data.filter((loc) => !loc.hidden) : [];
          setLocations(filtered);
        }
      } catch {
        if (mounted) setLocations([]);
      } finally {
        if (mounted) {
          setIsLocationsLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user?.id, currency.code, user?.currency?.code, currencyRefreshId, language, languageRefreshId]);

  useEffect(() => {
    let mounted = true;
    const loadBaseTariff = async () => {
      if (!user?.id || !user?.device_number) {
        if (mounted) setBaseMonthlyPrice(null);
        return;
      }
      try {
        const data = await fetchDeviceTariff(user.id, user.device_number);
        if (!mounted) return;
        const monthly = extractMonthlyTariff(data);
        setBaseMonthlyPrice(monthly);
      } catch {
        if (mounted) setBaseMonthlyPrice(null);
      }
    };
    loadBaseTariff();
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.device_number, currency.code, currencyRefreshId, user?.currency?.code]);

  const selectedIds = useMemo(
    () => locations.filter((loc) => loc.selected).map((loc) => loc.id),
    [locations]
  );

  const selectedCountText = useMemo(() => {
    const count = selectedIds.length;
    if (count === 0) {
      return t('locations.select_at_least_one');
    }
    if (language === 'ru') {
      const last = count % 10;
      const lastTwo = count % 100;
      if (lastTwo < 11 || lastTwo > 14) {
        if (last === 1) return t('locations.selected_count_one', { count });
        if (last >= 2 && last <= 4) return t('locations.selected_count_few', { count });
      }
      return t('locations.selected_count_many', { count });
    }
    return t('locations.selected_count', { count });
  }, [selectedIds.length, language, t]);

  const basePrice = useMemo(() => {
    if (baseMonthlyPrice != null && Number.isFinite(baseMonthlyPrice)) {
      return baseMonthlyPrice;
    }
    const fallbackDaily = Number(user?.tariff);
    if (Number.isFinite(fallbackDaily) && fallbackDaily > 0) {
      return fallbackDaily * 30;
    }
    return 0;
  }, [baseMonthlyPrice, user?.tariff]);

  const locationsCost = useMemo(
    () =>
      locations
        .filter((loc) => loc.selected)
        .reduce((sum, loc) => sum + (Number(loc.price) || 0), 0),
    [locations]
  );

  useEffect(() => {
    let mounted = true;
    const loadLocationsTariff = async () => {
      if (!user?.id) {
        if (mounted) setServerTotalMonthly(null);
        return;
      }
      if (!selectedIds.length) {
        if (mounted) setServerTotalMonthly(basePrice);
        return;
      }
      try {
        const total = await fetchLocationsTariff(user.id, selectedIds);
        if (mounted) {
          setServerTotalMonthly(Number.isFinite(total) ? total : null);
        }
      } catch {
        if (mounted) {
          setServerTotalMonthly(null);
        }
      }
    };
    loadLocationsTariff();
    return () => {
      mounted = false;
    };
  }, [user?.id, selectedIds, basePrice, currency.code, currencyRefreshId]);

  const locationsCostFromServer = useMemo(() => {
    if (serverTotalMonthly == null) return null;
    return Math.max(0, serverTotalMonthly - basePrice);
  }, [serverTotalMonthly, basePrice]);

  const effectiveLocationsCost = locationsCostFromServer ?? locationsCost;
  const totalMonthly = serverTotalMonthly ?? (basePrice + locationsCost);
  const activeServerCurrencyCode = user?.currency?.code || currency.code;
  const formatPrice = (value: number) => {
    const amount = Number(value) || 0;
    if (activeServerCurrencyCode && activeServerCurrencyCode !== currency.code) {
      const sourceCurrency = currencies.find((item) => item.code === activeServerCurrencyCode);
      const precision = sourceCurrency?.rounding_precision ?? 2;
      const formatted = precision > 0 ? amount.toFixed(precision) : Math.round(amount).toString();
      return `${formatted} ${activeServerCurrencyCode}`;
    }
    return formatCurrency(amount, { showCode: true, showSymbol: false });
  };
  const showDetails = !isLocationsLoading && locations.length > 0;

  const getLocationName = (loc: LocationItem) => {
    const record = loc as Record<string, unknown>;
    const apiLang = language === 'am' ? 'hy' : language;
    const apiName =
      (typeof record[`name_${apiLang}`] === 'string' && String(record[`name_${apiLang}`])) ||
      (typeof record[`title_${apiLang}`] === 'string' && String(record[`title_${apiLang}`])) ||
      (typeof record[`country_${apiLang}`] === 'string' && String(record[`country_${apiLang}`])) ||
      (typeof record.name === 'string' && record.name) ||
      (typeof record.title === 'string' && String(record.title)) ||
      (typeof record.country === 'string' && String(record.country));
    if (apiName) return apiName;
    const localized = LOCATION_LOCALIZED[loc.id]?.[language];
    const fallback =
      localized ||
      LOCATION_LOCALIZED[loc.id]?.en ||
      LOCATION_LOCALIZED[loc.id]?.ru ||
      LOCATION_LOCALIZED[loc.id]?.am;
    return fallback?.name || loc.name || t('locations.unknown_location');
  };

  const getLocationDescription = (loc: LocationItem) => {
    const record = loc as Record<string, unknown>;
    const apiLang = language === 'am' ? 'hy' : language;
    const apiDescription =
      (typeof record[`description_${apiLang}`] === 'string' && String(record[`description_${apiLang}`])) ||
      (typeof record[`city_${apiLang}`] === 'string' && String(record[`city_${apiLang}`])) ||
      (typeof record.description === 'string' && record.description) ||
      (typeof record.city === 'string' && String(record.city));
    if (apiDescription) return apiDescription;
    const localized = LOCATION_LOCALIZED[loc.id]?.[language];
    const fallback =
      localized ||
      LOCATION_LOCALIZED[loc.id]?.en ||
      LOCATION_LOCALIZED[loc.id]?.ru ||
      LOCATION_LOCALIZED[loc.id]?.am;
    return fallback?.description || loc.description || '';
  };


  const toggleLocation = (id: number) => {
    setLocations((prev) =>
      prev.map((loc) =>
        loc.id === id ? { ...loc, selected: !loc.selected } : loc
      )
    );
  };

  const handleSave = async () => {
    if (!user?.id || selectedIds.length < 1) return;
    setIsSaving(true);
    try {
      await updateLocations(user.id, selectedIds);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="locations-page loading">
        <div className="locations-loading">
          <span className="loading-spinner"></span>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="locations-page">
        <div className="error-container">
          <p style={{ color: 'red' }}>{t('common.error_prefix')}: {error}</p>
          <p>{t('common.check_token')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="locations-page">
        <div className="auth-required">
          <p>{t('common.auth_required')}</p>
          <p>{t('common.add_token')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="locations-page">
      <header className="locations-mobile-header">
        <button className="back-button" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M5 12L12 19M5 12L12 5"></path>
          </svg>
        </button>
        <div className="header-title">{t('locations.header_title')}</div>
        <div className="header-spacer"></div>
      </header>

      <div className="hero-section">
        <div className="hero-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </div>
        <h1 className="hero-title">{t('locations.hero_title')}</h1>
        <p className="hero-subtitle">{t('locations.hero_subtitle')}</p>
      </div>

      {showDetails && (
        <div className="selected-count-section">
          <div className={`selected-badge ${selectedIds.length === 0 ? 'empty' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span className="selected-badge-text">{selectedCountText}</span>
          </div>
        </div>
      )}

      <div className="locations-grid">
        {isLocationsLoading ? (
          <div className="locations-loading">
            <span className="loading-spinner"></span>
            <p>{t('common.loading')}</p>
          </div>
        ) : (
          locations.map((loc, index) => (
            <div
              key={loc.id}
              className={`location-card ${loc.selected ? 'selected' : ''}`}
              style={{ animationDelay: `${index * 0.04}s` }}
              onClick={() => toggleLocation(loc.id)}
            >
              <div className="location-header">
                <div className="location-info">
                  <div className="location-flag">{loc.flag || '🏳️'}</div>
                  <div className="location-details">
                    <h3>{getLocationName(loc)}</h3>
                    <p>{getLocationDescription(loc)}</p>
                  </div>
                </div>
                <div className="location-checkbox">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
              <div className="location-features">
                <div className="location-feature">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  <span className="location-feature-value">+{formatPrice(loc.price || 0)}</span>
                </div>
                <div className="location-feature">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18"></path>
                    <path d="M18 9l-5 5-4-4-6 6"></path>
                  </svg>
                  <span className="location-feature-value">{loc.speed || 0} Gbps</span>
                </div>
                <div className="location-feature">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                  </svg>
                  <span className="location-feature-value">99.9%</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showDetails && (
        <>
          <div className="pricing-summary">
            <div className="pricing-title">{t('locations.pricing_title')}</div>
            <div className="pricing-row">
              <span className="pricing-label">{t('locations.base_tariff')}</span>
              <span className="pricing-value">{formatPrice(basePrice)}</span>
            </div>
            <div className="pricing-row">
              <span className="pricing-label">{t('locations.selected_locations')}</span>
              <span className="pricing-value">{selectedIds.length}</span>
            </div>
            <div className="pricing-row">
              <span className="pricing-label">{t('locations.locations_cost')}</span>
              <span className="pricing-value">{formatPrice(effectiveLocationsCost)}</span>
            </div>
            <div className="pricing-row">
              <span className="pricing-label pricing-total-label">{t('locations.total_monthly')}</span>
              <span className="pricing-value pricing-total">{formatPrice(totalMonthly)}</span>
            </div>
          </div>

          <div className="bottom-actions">
            <button
              className="save-button"
              onClick={handleSave}
              disabled={selectedIds.length < 1 || isSaving}
            >
              <span>{t('locations.save_button')}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            <div className="info-note">{t('locations.info_note')}</div>
          </div>
        </>
      )}
    </div>
  );
}
