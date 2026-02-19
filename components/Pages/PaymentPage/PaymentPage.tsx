'use client'
import React, { useEffect, useMemo, useState } from 'react';
import './PaymentPage.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useUser } from '@/contexts/UserContext';
import { fetchPaymentBonus, fetchPaymentTariffs } from '@/lib/api';

interface PaymentPageProps {
  onBack?: () => void;
}

type PaymentStep = 1 | 2 | 3;

type AmountPreset = {
  amount: number;
  bonus: number;
};

const AMOUNT_PRESETS: AmountPreset[] = [
  { amount: 150, bonus: 0 },
  { amount: 450, bonus: 0 },
  { amount: 850, bonus: 50 },
  { amount: 1600, bonus: 200 },
];

export default function PaymentPage({ onBack }: PaymentPageProps) {
  const { t } = useLanguage();
  const { currency, formatNumber } = useCurrency();
  const { user, isLoading, error, isAuthenticated } = useUser();

  const [step, setStep] = useState<PaymentStep>(1);
  const [selectedMethod, setSelectedMethod] = useState<'rub' | 'crypto'>('rub');
  const [selectedPreset, setSelectedPreset] = useState<AmountPreset | null>(AMOUNT_PRESETS[0]);
  const [amountInput, setAmountInput] = useState<string>(String(AMOUNT_PRESETS[0].amount));
  const [amountPresets, setAmountPresets] = useState<AmountPreset[]>(AMOUNT_PRESETS);
  const [bonusValue, setBonusValue] = useState<number>(AMOUNT_PRESETS[0].bonus);
  const [isBonusLoading, setIsBonusLoading] = useState(false);

  const amountValue = Math.max(0, Number(amountInput || 0));
  const fallbackBonus = selectedPreset?.amount === amountValue ? selectedPreset.bonus : 0;
  const totalValue = amountValue + bonusValue;

  const isRubCurrency = currency.code === 'RUB';
  const isUsdLike = currency.code === 'USD' || currency.code === 'AMD';

  const paymentMethods = useMemo(() => {
    const rubMethod = {
      id: 'rub' as const,
      title: t('payment.method_rub_title'),
      subtitle: t('payment.method_available'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="6" width="18" height="12" rx="2"></rect>
          <path d="M3 10H21"></path>
          <circle cx="7" cy="14" r="1.5" fill="currentColor"></circle>
        </svg>
      ),
    };
    const cryptoMethod = {
      id: 'crypto' as const,
      title: t('payment.method_crypto_title'),
      subtitle: t('payment.method_available'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M8 11h6a2 2 0 0 1 0 4H9.5a2 2 0 0 0 0 4H14"></path>
          <path d="M12 7v10"></path>
        </svg>
      ),
    };
    return isRubCurrency && !isUsdLike ? [rubMethod, cryptoMethod] : [cryptoMethod];
  }, [isRubCurrency, isUsdLike, t]);

  useEffect(() => {
    if (!isRubCurrency || isUsdLike) {
      setSelectedMethod('crypto');
    }
  }, [isRubCurrency, isUsdLike]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const tariffs = await fetchPaymentTariffs();
        if (!active || tariffs.length === 0) return;
        const mapped = tariffs
          .map((tariff) => ({
            amount: Number(tariff.amount),
            bonus: Number(tariff.bonus || 0),
          }))
          .filter((preset) => Number.isFinite(preset.amount) && preset.amount > 0)
          .sort((a, b) => a.amount - b.amount);

        if (!mapped.length) return;

        setAmountPresets(mapped);
        const currentAmount = Number(amountInput || 0);
        const matched = mapped.find((preset) => preset.amount === currentAmount) || null;
        if (selectedPreset) {
          if (matched) {
            setSelectedPreset(matched);
          } else {
            setSelectedPreset(mapped[0]);
            setAmountInput(String(mapped[0].amount));
          }
        } else {
          setSelectedPreset(matched);
        }
      } catch {
        // Используем дефолтные пресеты при ошибке.
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [currency.code, amountInput, selectedPreset]);

  useEffect(() => {
    setBonusValue(fallbackBonus);
  }, [fallbackBonus]);

  useEffect(() => {
    if (amountValue <= 0) {
      setBonusValue(0);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setIsBonusLoading(true);
        const bonus = await fetchPaymentBonus(amountValue, currency.code, controller.signal);
        if (active) {
          setBonusValue(Number.isFinite(bonus) ? bonus : fallbackBonus);
        }
      } catch {
        if (active) {
          setBonusValue(fallbackBonus);
        }
      } finally {
        if (active) {
          setIsBonusLoading(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [amountValue, currency.code, fallbackBonus]);

  const minimumAmount = useMemo(() => {
    const values = amountPresets.map((preset) => preset.amount).filter((amount) => Number.isFinite(amount) && amount > 0);
    return values.length ? Math.min(...values) : 50;
  }, [amountPresets]);

  const hasInput = amountInput.trim().length > 0;
  const isBelowMinimum = hasInput && amountValue > 0 && amountValue < minimumAmount;
  const canPay = amountValue >= minimumAmount;

  const handleMethodSelect = (methodId: 'rub' | 'crypto') => {
    setSelectedMethod(methodId);
    setStep(2);
  };

  const handlePresetSelect = (preset: AmountPreset) => {
    setSelectedPreset(preset);
    setAmountInput(String(preset.amount));
  };

  const handleAmountInput = (value: string) => {
    const digits = value.replace(/[^\d]/g, '');
    setAmountInput(digits);
    setSelectedPreset(null);
  };

  const handlePay = () => {
    if (amountValue <= 0) return;
    setStep(3);
  };

  if (isLoading) {
    return (
      <div className="payment-page loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="payment-page">
        <div className="error-container">
          <p style={{ color: 'red' }}>{t('common.error_prefix')}: {error}</p>
          <p>{t('common.check_token')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="payment-page">
        <div className="auth-required">
          <p>{t('common.auth_required')}</p>
          <p>{t('common.add_token')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <header className="payment-mobile-header">
        <button className="back-button" onClick={() => onBack?.()} aria-label={t('common.back')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M5 12L12 19M5 12L12 5"></path>
          </svg>
        </button>
        <div className="header-title">{t('payment.title')}</div>
        <div className="header-spacer"></div>
      </header>

      <div className="payment-progress">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className={`payment-progress-segment ${step >= index ? 'active' : ''}`}
            onClick={() => {
              if (index < step) setStep(index as PaymentStep);
            }}
            role="button"
            tabIndex={index < step ? 0 : -1}
            aria-label={`Step ${index}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="payment-step">
          <div className="payment-step-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="5" y="10" width="14" height="10" rx="2"></rect>
              <path d="M8 10V7a4 4 0 1 1 8 0v3"></path>
            </svg>
          </div>
          <h2 className="payment-step-title">{t('payment.step_method_title')}</h2>
          <p className="payment-step-subtitle">{t('payment.step_method_subtitle')}</p>

          <div className="payment-methods">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                className={`payment-method-card ${selectedMethod === method.id ? 'active' : ''}`}
                onClick={() => handleMethodSelect(method.id)}
              >
                <div className="payment-method-icon">{method.icon}</div>
                <div className="payment-method-info">
                  <div className="payment-method-title">{method.title}</div>
                  <div className="payment-method-subtitle">{method.subtitle}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="payment-step-note">{t('payment.secure_note')}</div>
        </div>
      )}

      {step === 2 && (
        <div className="payment-step">
          <div className="payment-step-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v10"></path>
              <path d="M8.5 10.5c0-1.3 1.3-2.3 3.5-2.3s3.5 1 3.5 2.3-1.3 2.3-3.5 2.3-3.5 1-3.5 2.3 1.3 2.3 3.5 2.3 3.5-1 3.5-2.3"></path>
            </svg>
          </div>
          <h2 className="payment-step-title">{t('payment.step_amount_title')}</h2>
          <p className="payment-step-subtitle">{t('payment.step_amount_subtitle')}</p>

          <div className="payment-amounts">
            {amountPresets.map((preset, index) => (
              <button
                key={preset.amount}
                type="button"
                className={`payment-amount-chip ${amountValue === preset.amount ? 'active' : ''}`}
                onClick={() => handlePresetSelect(preset)}
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <span>{formatNumber(preset.amount)} {currency.code}</span>
                {preset.bonus > 0 ? (
                  <span className="payment-amount-bonus">+{formatNumber(preset.bonus)} {currency.code}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="payment-input-card">
            <div className="payment-input-label">{t('payment.input_label')}</div>
            <div className={`payment-input-field ${isBelowMinimum ? 'error' : ''}`}>
              <span className="payment-input-currency">{currency.symbol || currency.code}</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(event) => handleAmountInput(event.target.value)}
                placeholder="0"
              />
            </div>
            {isBelowMinimum ? (
              <div className="payment-input-error">
                {t('payment.min_error', { amount: formatNumber(minimumAmount), currency: currency.code })}
              </div>
            ) : null}
          </div>

          <div className="payment-calc-card">
            <div className="payment-calc-title">{t('payment.calculation_title')}</div>
            <div className="payment-calc-row">
              <span>{t('payment.calc_amount')}</span>
              <span>{formatNumber(amountValue)} {currency.code}</span>
            </div>
            <div className="payment-calc-row">
              <span>{t('payment.calc_bonus')}</span>
              <span className="payment-calc-bonus">
                {isBonusLoading ? '…' : formatNumber(bonusValue)} {currency.code}
              </span>
            </div>
            <div className="payment-calc-row total">
              <span>{t('payment.calc_total')}</span>
              <span>{formatNumber(totalValue)} {currency.code}</span>
            </div>
          </div>

          <button
            type="button"
            className="payment-cta"
            disabled={!canPay}
            onClick={handlePay}
          >
            {t('payment.pay_button')}
            <span className="payment-cta-arrow">›</span>
          </button>

          <div className="payment-step-note">
            {t('payment.minimum_note', { amount: formatNumber(minimumAmount), currency: currency.code })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="payment-step">
          <div className="payment-spinner"></div>
          <h2 className="payment-step-title">{t('payment.step_processing_title')}</h2>
          <p className="payment-step-subtitle">{t('payment.step_processing_subtitle')}</p>

          <div className="payment-details-card">
            <div className="payment-details-label">{t('payment.details_title')}</div>
            <div className="payment-details-name">{t('payment.details_name')}</div>
            <div className="payment-details-amount">{formatNumber(amountValue)} {currency.code}</div>
          </div>
        </div>
      )}
    </div>
  );
}

