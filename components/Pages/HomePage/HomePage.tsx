'use client'
import React, { useState, useEffect, useRef } from 'react';
import './HomePage.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { fetchAvailableLocations, LocationItem } from '@/lib/api'; // Добавляем импорт

type HomePageProps = {
  onNavigate?: (page: 'home' | 'subscription' | 'invite' | 'raffle' | 'locations' | 'devices' | 'help' | 'install' | 'payment' | 'history') => void;
};

export default function HomePage({ onNavigate }: HomePageProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const sliderRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const autoplayRef = useRef<NodeJS.Timeout>();
  const prevSlideRef = useRef(0);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const { currency, currencyRefreshId, formatCurrency, formatMoneyFrom } = useCurrency();

  // Используем хук для получения данных пользователя
  const { user, isLoading, error, isAuthenticated } = useUser();
  const { language, t, languageRefreshId } = useLanguage();

  const touchStateRef = useRef({ startX: 0, currentX: 0, isDragging: false });

  // Данные для промо-слайдера
  const promoSlides = [
    {
      id: 1,
      type: 'locations',
      title: t('promo.locations_title'),
      subtitle: t('promo.locations_subtitle'),
      background: 'linear-gradient(135deg, #1a3a5a 0%, #0d2a4a 50%, #061a3a 100%)',
      onClick: () => handleLocations(),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
          <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" fill="rgba(255,255,255,0.1)"></circle>
          <path d="M2 12h20" stroke="white" strokeWidth="1.5" strokeLinecap="round"></path>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="white" strokeWidth="1.5"></path>
          <path d="M2 12c0-2 3-4 10-4s10 2 10 4" stroke="white" strokeWidth="1" opacity="0.5"></path>
        </svg>
      )
    },
    {
      id: 2,
      type: 'invite',
      title: t('promo.invite_title'),
      subtitle: t('promo.invite_subtitle', { amount: formatCurrency(50) }),
      background: 'linear-gradient(135deg, #1a4a4a 0%, #2d5a5a 50%, #3a6868 100%)',
      onClick: () => handleReferral(),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
          <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
          <circle cx="9" cy="7" r="4" stroke="white" strokeWidth="1.5" fill="rgba(255,255,255,0.15)"></circle>
          <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
          <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
        </svg>
      )
    },
    {
      id: 3,
      type: 'xhttp',
      title: t('promo.xhttp_title'),
      subtitle: t('promo.xhttp_subtitle'),
      background: 'linear-gradient(135deg, #2d4a6a 0%, #3d5a7a 50%, #4a6888 100%)',
      onClick: () => handleDeposit(),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" fill="rgba(255,255,255,0.15)"></circle>
          <path d="M12 7V17" stroke="white" strokeWidth="1.5" strokeLinecap="round"></path>
          <path d="M15 9.5C15 8.12 13.657 7.5 12 7.5C10.343 7.5 9 8.12 9 9.5C9 10.88 10.343 11.5 12 11.5C13.657 11.5 15 12.62 15 14C15 15.38 13.657 16.5 12 16.5C10.343 16.5 9 15.38 9 14" stroke="white" strokeWidth="1.5" strokeLinecap="round"></path>
        </svg>
      )
    }
  ];

  const startAutoplay = () => {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
    }
    if (promoSlides.length < 2) {
      return;
    }
    autoplayRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % promoSlides.length);
    }, 7000);
  };

  useEffect(() => {
    if (currentSlide >= promoSlides.length) {
      setCurrentSlide(0);
    }
  }, [currentSlide, promoSlides.length]);

  useEffect(() => {
    const total = promoSlides.length;
    if (total < 2) return;
    const prev = prevSlideRef.current;
    if (prev === currentSlide) return;
    const forward = (prev + 1) % total === currentSlide;
    const backward = (prev - 1 + total) % total === currentSlide;
    setSlideDirection(forward ? 'forward' : backward ? 'backward' : currentSlide > prev ? 'forward' : 'backward');
    prevSlideRef.current = currentSlide;
  }, [currentSlide, promoSlides.length]);

  // Автопрокрутка слайдера
  useEffect(() => {
    startAutoplay();

    return () => {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
      }
    };
  }, [promoSlides.length]);

  // Обновление позиции слайдера (плавность задается в CSS)
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${currentSlide * 100}%)`;
    }
  }, [currentSlide]);

  // Обработчики кликов
  const handleReferral = () => {
    if (onNavigate) {
      onNavigate('invite');
      return;
    }
    console.log('Клик по реферальной программе');
  };

  const handleDeposit = () => {
    console.log('Клик по пополнению');
  };

  const handleRaffle = () => {
    if (onNavigate) {
      onNavigate('raffle');
      return;
    }
    console.log('Клик по розыгрышу');
  };

  const handleInvite = () => {
    console.log('Пригласить друзей');
    if (onNavigate) {
      onNavigate('invite');
      return;
    }
    if (user?.web_referral_link) {
      window.open(user.web_referral_link, '_blank');
    }
  };

  const handleHistory = () => {
    if (onNavigate) {
      onNavigate('history');
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/user/payments-history');
    }
  };

  const handleMore = () => {
    console.log('Ещё действия');
  };

  const handleInstall = () => {
    if (onNavigate) {
      onNavigate('install');
      return;
    }
    console.log('Установка и настройка');
  };

  const handleLocations = () => {
    if (onNavigate) {
      onNavigate('locations');
      return;
    }
    console.log('Изменить локации');
  };

  const handleDevices = () => {
    if (onNavigate) {
      onNavigate('devices');
      return;
    }
    console.log('Изменить лимит устройств');
  };

  const handleDepositClick = () => {
    if (onNavigate) {
      onNavigate('payment');
      return;
    }
    if (typeof window === 'undefined') return;
    window.location.assign('/user/payment');
  };

  useEffect(() => {
    let mounted = true;
    const loadLocations = async () => {
      if (!user?.id) return;
      try {
        const data = await fetchAvailableLocations(
          user.id,
          language,
          user?.currency?.code || currency.code,
          user?.currency?.code
        );
        if (mounted) {
          setLocations(Array.isArray(data) ? data : []);
        }
      } catch {
        if (mounted) {
          setLocations([]);
        }
      }
    };
    loadLocations();
    return () => {
      mounted = false;
    };
  }, [user?.id, currency.code, user?.currency?.code, currencyRefreshId, language, languageRefreshId]);

  const balanceAmount = user?.balance ?? 0;
  const displayAmount = formatMoneyFrom(balanceAmount, user?.currency || null, { showSymbol: false, showCode: false });

  const selectedLocationFlags = locations
    .filter((loc) => loc.selected)
    .map((loc) => loc.flag || loc.text || '')
    .filter(Boolean);
  const selectedLocationText = selectedLocationFlags.length
    ? t('management.selected', { value: selectedLocationFlags.join(' ') })
    : t('management.not_selected');
  
  const daysRemainingText = (() => {
    if (!user?.expire) return '';
    const msPerDay = 1000 * 60 * 60 * 24;
    const dateOnlyMatch = user.expire.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const expireMs = dateOnlyMatch
      ? Date.UTC(
          Number(dateOnlyMatch[1]),
          Number(dateOnlyMatch[2]) - 1,
          Number(dateOnlyMatch[3]),
          20,
          59,
          59,
          999
        )
      : new Date(user.expire).getTime();
    if (!Number.isFinite(expireMs)) return '';
    const diffTime = expireMs - Date.now();
    if (diffTime < 0) return t('days.expired');
    if (diffTime < msPerDay) return t('days.expires_today');
    const diffDays = Math.ceil(diffTime / msPerDay);

    if (language === 'ru') {
      const last = diffDays % 10;
      const lastTwo = diffDays % 100;
      if (lastTwo < 11 || lastTwo > 14) {
        if (last === 1) return t('days.remaining_one', { count: diffDays });
        if (last >= 2 && last <= 4) return t('days.remaining_few', { count: diffDays });
      }
    }

    return t('days.remaining', { count: diffDays });
  })();

  // Ручное переключение слайдов
  const goToSlide = (index: number) => {
    const total = promoSlides.length;
    if (!total) return;
    const normalized = ((index % total) + total) % total;
    setCurrentSlide(normalized);
    startAutoplay();
  };

  // Пауза автопрокрутки при наведении
  const handleMouseEnter = () => {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
    }
  };

  const handleMouseLeave = () => {
    startAutoplay();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return;
    const touch = event.touches[0];
    touchStateRef.current.startX = touch.clientX;
    touchStateRef.current.currentX = touch.clientX;
    touchStateRef.current.isDragging = true;
    sliderRef.current.classList.add('dragging');
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
    }
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStateRef.current.isDragging || !sliderRef.current || !trackRef.current) return;
    const touch = event.touches[0];
    touchStateRef.current.currentX = touch.clientX;
    const diff = touchStateRef.current.currentX - touchStateRef.current.startX;
    const percent = (diff / sliderRef.current.offsetWidth) * 100;
    trackRef.current.style.transform = `translateX(calc(-${currentSlide * 100}% + ${percent}%))`;
  };

  const handleTouchEnd = () => {
    if (!touchStateRef.current.isDragging || !sliderRef.current) return;
    touchStateRef.current.isDragging = false;
    sliderRef.current.classList.remove('dragging');

    const diff = touchStateRef.current.currentX - touchStateRef.current.startX;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      if (diff < 0) {
        goToSlide(currentSlide + 1);
      } else {
        goToSlide(currentSlide - 1);
      }
    } else {
      goToSlide(currentSlide);
    }
  };

  // Если данные загружаются
  if (isLoading) {
    return (
      <div className="home-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Если есть ошибка
  if (error && !user) {
    return (
      <div className="home-page">
        <div className="error-container">
          <p style={{ color: 'red' }}>{t('common.error_prefix')}: {error}</p>
          <p>{t('common.check_token')}</p>
        </div>
      </div>
    );
  }

  // Если пользователь не авторизован
  if (!isAuthenticated && !isLoading) {
    return (
      <div className="home-page">
        <div className="auth-required">
          <p>{t('common.auth_required')}</p>
          <p>{t('common.add_token')}</p>
        </div>
      </div>
    );
  }

  // Основной рендеринг с реальными данными
  return (
    <div className="home-page">
      {/* ОБНОВЛЕННЫЙ БЛОК БАЛАНСА */}
      <div className="balance-block">
        <div className="balance-all">
          <div className="balance-header">{t('balance.title')}</div>
          <div className="balance-container">
            <div className="balance-left">
              <span 
                className="balance-amount fade-in" 
                id="balance-amount"
                style={{ transition: 'opacity 0.3s ease-out', opacity: 1 }}
              >
                {displayAmount || '0.00'}
              </span>
              <span
                className="currency-symbol visible"
                id="currency-symbol"
              >
                {currency.code}
              </span>
              {daysRemainingText ? (
                <span id="days-remaining" className="days-remaining-text visible">{daysRemainingText}</span>
              ) : null}
            </div>
            <button className="deposit-button" onClick={handleDepositClick}>{t('balance.deposit')}</button>
          </div>
        </div>
        
        <div className="balance-divider"></div>
        
        <div className="quick-actions">
          <div className="action-item" onClick={handleInvite}>
            <div className="action-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none">
                <path fill="currentColor" fillRule="evenodd" d="M1.464 15.465A5 5 0 0 1 5 14h7a5 5 0 0 1 5 5 3 3 0 0 1-3 3H3a3 3 0 0 1-3-3 5 5 0 0 1 1.464-3.536M5 16a3 3 0 0 0-3 3 1 1 0 0 0 1 1h11a1 1 0 0 0 1-1 3 3 0 0 0-3-3zM8.5 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6m-5 3a5 5 0 1 1 10 0 5 5 0 0 1-10 0M20 7a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1" clipRule="evenodd"></path>
                <path fill="currentColor" fillRule="evenodd" d="M16 11a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1" clipRule="evenodd"></path>
              </svg>
            </div>
            <span className="action-label">{t('actions.invite')}</span>
          </div>
          
          <div className="action-item" onClick={handleHistory}>
            <div className="action-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.586 2.586A2 2 0 0 0 13.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.828a2 2 0 0 0-.586-1.414z"></path>
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.714 10H16m-4.286 3.496H16m-4.286 3.495H16M8.009 10H8v.009m.009 3.487H8v.008m.009 3.487H8V17"></path>
              </svg>
            </div>
            <span className="action-label">{t('actions.history')}</span>
          </div>
          
          <div className="action-item" onClick={handleMore}>
            <div className="action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </div>
            <span className="action-label">{t('actions.more')}</span>
          </div>
        </div>
      </div>

      {/* PROMO SLIDER - ПОЛНОСТЬЮ СОХРАНЯЕМ ВАШ КОД */}
      <div 
        className="promo-slider" 
        id="promo-slider"
        ref={sliderRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="promo-slider-track" 
          id="promo-slider-track"
          ref={trackRef}
          style={{
            transform: `translateX(-${currentSlide * 100}%)`,
            transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          {promoSlides.map((slide, index) => (
            <div
              key={slide.id}
              className={`promo-slide ${currentSlide === index ? 'active' : ''}`}
              style={{ background: slide.background }}
              onClick={slide.onClick}
            >
              <div className="promo-slide-stars"></div>
              <div className="promo-slide-content">
                <div className="promo-slide-title">{slide.title}</div>
                <div className="promo-slide-subtitle">{slide.subtitle}</div>
              </div>
              <div className="promo-slide-icon">{slide.icon}</div>
            </div>
          ))}
        </div>
        <div className="promo-slider-dots" id="promo-slider-dots">
          <span
            className="promo-slider-indicator"
            aria-hidden="true"
            style={{ transform: `translateX(${currentSlide * 12}px)` }}
          >
            <span
              key={`${currentSlide}-${slideDirection}`}
              className={`promo-slider-indicator-dot direction-${slideDirection}`}
            />
          </span>
          {promoSlides.map((_, index) => (
            <div 
              key={index}
              className={`promo-slider-dot ${currentSlide === index ? 'active' : ''}`}
              data-slide={index}
              onClick={() => goToSlide(index)}
            ></div>
          ))}
        </div>
      </div>

      {/* БЛОК УСТАНОВКИ */}
      <div className="section-header">
        <h2 className="section-title">{t('nav.install')}</h2>
        <span className="count-badge">1</span>
      </div>
      <div className="install-block" onClick={handleInstall}>
        <div className="install-content">
          <div className="install-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path>
            </svg>
          </div>
          <div className="install-text">
            <h3 className="install-title">{t('setup.title')}</h3>
            <span className="action-label">{t('setup.subtitle')}</span>
          </div>
          <button className="install-button">{t('setup.button')}</button>
        </div>
      </div>

      {/* БЛОК УПРАВЛЕНИЯ */}
      <div className="section-header">
        <h2 className="section-title">{t('management.title')}</h2>
        <span className="count-badge">2</span>
      </div>

      <div className="referrals-card">
        <div className="referrals-list">
          {/* Карточка Локации */}
          <div className="referral-item" onClick={handleLocations}>
            <div className="referral-avatar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5"></circle>
                <path d="M2 12h20" strokeWidth="1.5"></path>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeWidth="1.5"></path>
              </svg>
            </div>
            <div className="referral-info">
              <div className="referral-name">{t('management.locations')}</div>
              <div 
                className="loading-field fade-in" 
                id="selected-locations"
                style={{ transition: 'opacity 0.3s ease-out', opacity: 1 }}
              >
                {selectedLocationText}
              </div>
            </div>
            <div className="referral-status">
              <div className="status-badge">{t('management.change')}</div>
            </div>
          </div>

          {/* Карточка Устройства */}
          <div className="referral-item" onClick={handleDevices}>
            <div className="referral-avatar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth="1.5"></rect>
                <circle cx="12" cy="18" r="1" fill="currentColor"></circle>
                <line x1="9" y1="6" x2="15" y2="6" strokeWidth="1.5" strokeLinecap="round"></line>
              </svg>
            </div>
            <div className="referral-info">
              <div className="referral-name">{t('management.device_limit')}</div>
              <div 
                className="loading-field fade-in" 
                id="device-limit"
                style={{ transition: 'opacity 0.3s ease-out', opacity: 1 }}
              >
                {t('management.devices_count', { count: user?.device_number || 0 })}</div>
            </div>
            <div className="referral-status">
              <div className="status-badge">{t('management.change')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

















