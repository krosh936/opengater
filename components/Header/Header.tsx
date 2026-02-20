'use client'
import React, { useState, useEffect, useRef } from 'react';
import './Header.css';
import Logo from './Logo';
import ProfileDropdown from './ProfileDropdown';
import ProfileAvatar from './ProfileAvatar';
import { useUser } from '@/contexts/UserContext';
import ProfileSlideMenu from './ProfileSlideMenu';
import { useTheme } from '@/contexts/ThemeContext';

const Header: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const { user, isLoading } = useUser();
  const { toggleTheme } = useTheme();
  const [authLabelFallback, setAuthLabelFallback] = useState('');

  const normalizedFallback = authLabelFallback.trim();
  const userEmail = user?.email || (user?.username?.includes('@') ? user.username : '');
  const fallbackEmail = normalizedFallback.includes('@') ? normalizedFallback : '';
  const name = user?.full_name || userEmail || user?.username || normalizedFallback || (isLoading ? '' : 'Гость');
  const email = userEmail || fallbackEmail;
  const uid = user?.id ? String(user.id) : '';
  const subscriptionActive = !!user && new Date(user.expire).getTime() > Date.now();
  const userData = {
    name,
    email,
    uid,
    subscriptionActive,
  };
  
  // РџРѕР»СѓС‡Р°РµРј РёРЅРёС†РёР°Р»С‹
  const getInitials = (name: string): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  const initials = getInitials(userData.name);
  
  const handleAvatarClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };
  
  const handleCloseDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleOpenMobileMenu = () => {
    setIsMobileMenuOpen(true);
  };

  const handleCloseMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fallback =
      localStorage.getItem('ga_user_email') ||
      localStorage.getItem('auth_user_label') ||
      '';
    setAuthLabelFallback(fallback);
  }, [user?.id]);

  // Р—Р°РєСЂС‹С‚РёРµ dropdown РїСЂРё РєР»РёРєРµ РІРЅРµ РµРіРѕ
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);
  
  // Р—Р°РєСЂС‹С‚РёРµ РїРѕ Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleOpen = () => setIsMobileMenuOpen(true);
    window.addEventListener('open-profile-menu', handleOpen);
    return () => {
      window.removeEventListener('open-profile-menu', handleOpen);
    };
  }, []);

  useEffect(() => {
    const getScrollTop = () => {
      const main = document.querySelector('.main-content');
      const mainScroll = main instanceof HTMLElement ? main.scrollTop : 0;
      const windowScroll = window.scrollY || document.documentElement.scrollTop || 0;
      return Math.max(windowScroll, mainScroll);
    };

    const handleScroll = () => {
      setIsAtTop(getScrollTop() <= 10);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  return (
    <>
      <div
        className={`profile-menu-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        id="profileMenuOverlay"
        onClick={handleCloseMobileMenu}
      ></div>
      <ProfileSlideMenu
        isOpen={isMobileMenuOpen}
        onClose={handleCloseMobileMenu}
        userData={userData}
      />

      <header className="header">
        <div className="header-content">
          <Logo />
          <div className={`header-actions ${isAtTop ? '' : 'is-hidden'}`}>
            <button
              className="theme-switcher"
              type="button"
              aria-label="Toggle theme"
              onClick={toggleTheme}
            >
              <svg className="theme-icon moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
              <svg className="theme-icon sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            </button>
            <div className="profile-dropdown-container" ref={dropdownRef}>
              <ProfileAvatar 
                initials={initials} 
                onClick={handleAvatarClick}
              />
              <ProfileDropdown 
                isOpen={isDropdownOpen}
                onClose={handleCloseDropdown}
                userData={userData}
              />
            </div>
          </div>
        </div>
      </header>

      <header className="mobile-header">
        <Logo />
        <button
          className={`profile-avatar ${isAtTop ? '' : 'is-hidden'}`}
          id="profile-avatar"
          title="РџСЂРѕС„РёР»СЊ"
          onClick={handleOpenMobileMenu}
        >
          <span id="profile-initials" className="profile-initials visible">
            {initials || '?'}
          </span>
        </button>
      </header>
    </>
  );
};

export default Header;
