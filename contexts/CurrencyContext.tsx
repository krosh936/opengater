'use client';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { Currency, fetchCurrencies, setUserCurrency } from '@/lib/api';
import { useUser } from '@/contexts/UserContext';

interface CurrencyContextType {
  currency: Currency;
  currencies: Currency[];
  isLoading: boolean;
  currencyRefreshId: number;
  setCurrencyCode: (code: string) => Promise<void>;
  formatCurrency: (value: number, options?: { showSymbol?: boolean; showCode?: boolean }) => string;
  formatNumber: (value: number) => string;
  toRub: (value: number, fromCurrency?: Currency | null) => number;
  convertAmount: (value: number, fromCurrency?: Currency | null, toCurrencyCode?: string) => number;
  formatMoneyFrom: (value: number, fromCurrency?: Currency | null, options?: { showSymbol?: boolean; showCode?: boolean }) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const STORAGE_KEY = 'currency_code';
const PENDING_KEY = 'currency_pending_code';
const PENDING_TS_KEY = 'currency_pending_ts';
const PENDING_TTL_MS = 60 * 1000;

const DEFAULT_CURRENCIES: Currency[] = [
  { code: 'RUB', symbol: '₽', rate: 1, rounding_precision: 0, id: 1, hidden: false },
  { code: 'USD', symbol: '$', rate: 75, rounding_precision: 2, id: 2, hidden: false },
  { code: 'AMD', symbol: '֏', rate: 0.2, rounding_precision: 0, id: 3, hidden: false },
];

const findCurrency = (list: Currency[], code?: string | null) =>
  list.find((item) => item.code === code);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mergeCurrencies = (data: Currency[]) => {
  // Совмещаем данные API с дефолтами, чтобы UI работал даже при неполном ответе.
  const map = new Map(DEFAULT_CURRENCIES.map((item) => [item.code, item]));
  data.forEach((item) => {
    const existing = map.get(item.code);
    if (!existing) {
      map.set(item.code, {
        ...item,
        rate: Number.isFinite(Number(item.rate)) ? Number(item.rate) : 1,
        rounding_precision:
          Number.isFinite(Number(item.rounding_precision)) ? Number(item.rounding_precision) : 2,
      });
      return;
    }
    map.set(item.code, {
      ...existing,
      ...item,
      rate: Number.isFinite(Number(item.rate)) ? Number(item.rate) : existing.rate,
      rounding_precision:
        Number.isFinite(Number(item.rounding_precision))
          ? Number(item.rounding_precision)
          : existing.rounding_precision,
    });
  });
  return Array.from(map.values());
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { user, refreshUser } = useUser();
  const [currencies, setCurrencies] = useState<Currency[]>(DEFAULT_CURRENCIES);
  const [selectedCode, setSelectedCode] = useState<string>('RUB');
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [currencyRefreshId, setCurrencyRefreshId] = useState(0);
  const pendingSyncRef = useRef<{ code: string; ts: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadCurrencies = async () => {
      setIsLoading(true);
      try {
        const data = await fetchCurrencies();
        if (!mounted) return;
        const filtered = Array.isArray(data) ? data.filter((item) => !item.hidden) : [];
        if (filtered.length) {
          setCurrencies(mergeCurrencies(filtered));
        }
      } catch {
        // keep fallback
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadCurrencies();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Читаем сохранённую валюту при первом клиентском рендере, чтобы не было рассинхрона.
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSelectedCode(saved);
    } else {
      localStorage.setItem(STORAGE_KEY, 'RUB');
      setSelectedCode('RUB');
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!user?.currency?.code) return;
    if (typeof window !== 'undefined') {
      const pending = localStorage.getItem(PENDING_KEY);
      const pendingTs = Number(localStorage.getItem(PENDING_TS_KEY) || 0);
      if (pending) {
        if (pending === user.currency.code) {
          localStorage.removeItem(PENDING_KEY);
          localStorage.removeItem(PENDING_TS_KEY);
          pendingSyncRef.current = null;
        } else if (Date.now() - pendingTs < PENDING_TTL_MS) {
          if (user?.id) {
            const lastAttempt = pendingSyncRef.current;
            const shouldAttempt =
              !lastAttempt || lastAttempt.code !== pending || Date.now() - lastAttempt.ts > 3000;
            if (shouldAttempt) {
              pendingSyncRef.current = { code: pending, ts: Date.now() };
              const pendingCurrency = findCurrency(currencies, pending);
              const pendingCurrencyId = pendingCurrency?.id ?? null;
              setUserCurrency(user.id, pending, pendingCurrencyId)
                .then(() => refreshUser({ silent: true }))
                .catch(() => {});
            }
          }
          return;
        } else {
          localStorage.removeItem(PENDING_KEY);
          localStorage.removeItem(PENDING_TS_KEY);
          pendingSyncRef.current = null;
        }
      }
      localStorage.setItem(STORAGE_KEY, user.currency.code);
    }
    setSelectedCode(user.currency.code);
  }, [user?.currency?.code, user?.id, currencies, refreshUser]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, selectedCode);
  }, [isHydrated, selectedCode]);

  const currency = useMemo(() => {
    const found = findCurrency(currencies, selectedCode);
    if (found) return found;
    return {
      code: selectedCode,
      symbol: selectedCode,
      rate: 1,
      rounding_precision: 2,
      id: 0,
      hidden: false,
    } satisfies Currency;
  }, [currencies, selectedCode]);

  const toRub = (value: number, fromCurrency?: Currency | null) => {
    const source = fromCurrency || currency;
    if (!source?.rate || source.code === 'RUB') {
      return Number(value) || 0;
    }
    return (Number(value) || 0) * source.rate;
  };

  const convertAmount = (value: number, fromCurrency?: Currency | null, toCurrencyCode?: string) => {
    const source = fromCurrency || currency;
    const target = toCurrencyCode ? findCurrency(currencies, toCurrencyCode) : currency;
    if (!source || !target) return Number(value) || 0;
    if (source.code === target.code) return Number(value) || 0;
    const sourceRate = Number(source.rate) || 0;
    const targetRate = Number(target.rate) || 0;
    if (!sourceRate || !targetRate) return Number(value) || 0;
    const rubValue = source.code === 'RUB' ? (Number(value) || 0) : (Number(value) || 0) * sourceRate;
    if (target.code === 'RUB') return rubValue;
    return rubValue / targetRate;
  };

  const formatNumber = (value: number) => {
    const normalized = Number(value) || 0;
    const precision = currency?.rounding_precision ?? 0;
    return precision > 0 ? normalized.toFixed(precision) : Math.round(normalized).toString();
  };

  const formatCurrency = (value: number, options?: { showSymbol?: boolean; showCode?: boolean }) => {
    const valueFormatted = formatNumber(value);
    if (options?.showCode) {
      return `${valueFormatted} ${currency.code}`;
    }
    if (options?.showSymbol === false) {
      return valueFormatted;
    }
    const symbol = currency.symbol || currency.code;
    return `${symbol}${valueFormatted}`;
  };

  const formatMoneyFrom = (value: number, fromCurrency?: Currency | null, options?: { showSymbol?: boolean; showCode?: boolean }) => {
    const converted = convertAmount(value, fromCurrency, currency.code);
    return formatCurrency(converted, options);
  };

  const setCurrencyCode = async (code: string) => {
    if (code === selectedCode && user?.currency?.code === code) return;
    const nextCurrency = findCurrency(currencies, code);
    const nextCurrencyId = nextCurrency?.id ?? null;
    const fallbackCode = user?.currency?.code || selectedCode;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, code);
      localStorage.setItem(PENDING_KEY, code);
      localStorage.setItem(PENDING_TS_KEY, String(Date.now()));
    }
    setSelectedCode(code);

    if (!user?.id) {
      setCurrencyRefreshId((prev) => prev + 1);
      return;
    }

    let updated = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await setUserCurrency(user.id, code, nextCurrencyId);
        updated = true;
        break;
      } catch {
        if (attempt < 2) {
          await wait(250);
        }
      }
    }

    if (updated) {
      try {
        await refreshUser({ silent: true });
      } catch {
        // ignore and rely on background sync/pending keys
      }
    } else {
      setSelectedCode(fallbackCode);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, fallbackCode);
        localStorage.removeItem(PENDING_KEY);
        localStorage.removeItem(PENDING_TS_KEY);
      }
    }

    setCurrencyRefreshId((prev) => prev + 1);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencies,
        isLoading,
        currencyRefreshId,
        setCurrencyCode,
        formatCurrency,
        formatNumber,
        toRub,
        convertAmount,
        formatMoneyFrom,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
};
