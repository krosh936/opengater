'use client'
import React, { useEffect, useState } from 'react';
import './Sidebar.css';
import SidebarSection from './SidebarSection';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';

// РРјРїРѕСЂС‚РёСЂСѓРµРј РєРѕРјРїРѕРЅРµРЅС‚С‹ СЃС‚СЂР°РЅРёС†
import HomePage from '../Pages/HomePage/HomePage';
import SubscriptionPage from '../Pages/SubscriptionPage/SubscriptionPage';
import LocationsPage from '../Pages/LocationsPage/LocationsPage';
import DevicesPage from '../Pages/DevicesPage/DevicesPage';
import InvitePage from '../Pages/InvitePage/InvitePage';
import HelpPage from '../Pages/HelpPage/HelpPage';
import InstallPage from '../Pages/InstallPage/InstallPage';
import ProfilePage from '../Pages/ProfilePage/ProfilePage';
// Р”СЂСѓРіРёРµ СЃС‚СЂР°РЅРёС†С‹ РёРјРїРѕСЂС‚РёСЂСѓР№С‚Рµ РїРѕ РјРµСЂРµ СЃРѕР·РґР°РЅРёСЏ

// РўРёРїС‹ РґР»СЏ РЅР°РІРёРіР°С†РёРѕРЅРЅС‹С… СЌР»РµРјРµРЅС‚РѕРІ
export type NavItemType = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
};

export type SidebarSectionType = {
  title?: string;
  items: NavItemType[];
};

// РўРёРїС‹ РґР»СЏ СЃС‚СЂР°РЅРёС†
type PageType = 'home' | 'subscription' | 'invite' | 'raffle' | 'locations' | 'devices' | 'help' | 'install' | 'profile';
const ACTIVE_PAGE_STORAGE_KEY = 'opengater_active_page';
const pageTypes: PageType[] = ['home', 'subscription', 'invite', 'raffle', 'locations', 'devices', 'help', 'install', 'profile'];

const isPageType = (value: string): value is PageType => pageTypes.includes(value as PageType);


const Sidebar: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [activeItem, setActiveItem] = useState<PageType>('home'); // default start page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
    if (stored && isPageType(stored)) {
      setActiveItem(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activeItem);
  }, [activeItem]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleNavigate = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && isPageType(detail)) {
        setActiveItem(detail);
      }
    };
    window.addEventListener('app:navigate', handleNavigate as EventListener);
    return () => {
      window.removeEventListener('app:navigate', handleNavigate as EventListener);
    };
  }, []);
  
  // Р¤СѓРЅРєС†РёСЏ СЂРµРЅРґРµСЂР° Р°РєС‚РёРІРЅРѕР№ СЃС‚СЂР°РЅРёС†С‹
  const renderActivePage = () => {
    switch (activeItem) {
      case 'home':
        return <HomePage onNavigate={handleNavClick} />;
      case 'subscription':
        return <SubscriptionPage />;
      case 'invite':
        return <InvitePage onBack={() => handleNavClick('home')} />;
      case 'raffle':
        return <div className="page-placeholder">{t('nav.raffle')} ({t('common.in_development')})</div>;
      case 'locations':
        return <LocationsPage onBack={() => handleNavClick('home')} />;
      case 'devices':
        return <DevicesPage onBack={() => handleNavClick('home')} />;
      case 'help':
        return <HelpPage />;
      case 'install':
        return <InstallPage onBack={() => handleNavClick('home')} />;
      case 'profile':
        return <ProfilePage onBack={() => handleNavClick('home')} />;
      default:
        return <HomePage />; // РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РїРѕРєР°Р·С‹РІР°РµРј HomePage
    }
  };
  
  // РћР±СЂР°Р±РѕС‚С‡РёРє РєР»РёРєР° РїРѕ РЅР°РІРёРіР°С†РёРё
  const handleNavClick = (id: PageType) => {
    setActiveItem(id);
    console.log(`Navigating to: ${id}`);
  };
  
  // РћР±СЂР°Р±РѕС‚С‡РёРєРё РґР»СЏ СЃРїРµС†РёС„РёС‡РЅС‹С… РґРµР№СЃС‚РІРёР№
  const handleRaffleClick = () => {
    console.log('Raffle clicked');
    handleNavClick('raffle');
  };
  
  const handleLocationChange = () => {
    console.log('Location change');
    handleNavClick('locations');
  };
  
  const handleDevicesClick = () => {
    console.log('Devices clicked');
    handleNavClick('devices');
  };
  
  const handleSetupRedirect = () => {
    console.log('Setup redirect');
    handleNavClick('install');
  };
  
  // РћРїСЂРµРґРµР»СЏРµРј СЃРµРєС†РёРё СЃР°Р№РґР±Р°СЂР° (РІР°С€ РѕСЂРёРіРёРЅР°Р»СЊРЅС‹Р№ РєРѕРґ)
  const sections: SidebarSectionType[] = [
    {
      items: [
        {
          id: 'home',
          label: t('nav.home'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          ),
          onClick: () => handleNavClick('home'),
          active: activeItem === 'home'
        },
        {
          id: 'subscription',
          label: t('nav.subscription'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          ),
          onClick: () => handleNavClick('subscription'),
          active: activeItem === 'subscription'
        },
        {
          id: 'invite',
          label: t('nav.invite'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          ),
          onClick: () => handleNavClick('invite'),
          active: activeItem === 'invite'
        },
        {
          id: 'raffle',
          label: t('nav.raffle'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9.5C3 9.03534 3 8.80302 3.03843 8.60982C3.19624 7.81644 3.81644 7.19624 4.60982 7.03843C4.80302 7 5.03534 7 5.5 7H12H18.5C18.9647 7 19.197 7 19.3902 7.03843C20.1836 7.19624 20.8038 7.81644 20.9616 8.60982C21 8.80302 21 9.03534 21 9.5V9.5V9.5C21 9.96466 21 10.197 20.9616 10.3902C20.8038 11.1836 20.1836 11.8038 19.3902 11.9616C19.197 12 18.9647 12 18.5 12H12H5.5C5.03534 12 4.80302 12 4.60982 11.9616C3.81644 11.8038 3.19624 11.1836 3.03843 10.3902C3 10.197 3 9.96466 3 9.5V9.5V9.5Z" strokeLinejoin="round"></path>
              <path d="M4 12V16C4 17.8856 4 18.8284 4.58579 19.4142C5.17157 20 6.11438 20 8 20H9H15H16C17.8856 20 18.8284 20 19.4142 19.4142C20 18.8284 20 17.8856 20 16V12" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M12 7V20" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M11.3753 6.21913L9.3959 3.74487C8.65125 2.81406 7.26102 2.73898 6.41813 3.58187C5.1582 4.8418 6.04662 7 7.82843 7L11 7C11.403 7 11.6271 6.53383 11.3753 6.21913Z" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M12.6247 6.21913L14.6041 3.74487C15.3488 2.81406 16.739 2.73898 17.5819 3.58187C18.8418 4.8418 17.9534 7 16.1716 7L13 7C12.597 7 12.3729 6.53383 12.6247 6.21913Z" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          ),
          onClick: handleRaffleClick,
          active: activeItem === 'raffle'
        }
      ]
    },
    {
      title: t('sidebar.settings'),
      items: [
        {
          id: 'locations',
          label: t('nav.locations'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          ),
          onClick: handleLocationChange,
          active: activeItem === 'locations'
        },
        {
          id: 'devices',
          label: t('nav.devices'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12" y2="18"></line>
            </svg>
          ),
          onClick: handleDevicesClick,
          active: activeItem === 'devices'
        }
      ]
    },
    {
      title: t('sidebar.support'),
      items: [
        {
          id: 'help',
          label: t('nav.help'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 17H12.01M12 14C12.8906 12.0938 15 12.2344 15 10C15 8.5 14 7 12 7C10.4521 7 9.50325 7.89844 9.15332 9M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"></path>
            </svg>
          ),
          onClick: () => handleNavClick('help'),
          active: activeItem === 'help'
        },
        {
          id: 'install',
          label: t('nav.install'),
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
            </svg>
          ),
          onClick: handleSetupRedirect,
          active: activeItem === 'install'
        }
      ]
    }
  ];

  return (
    <div className="page-layout">
      {/* Sidebar */}
      <nav className={`sidebar ${theme}`}>
        {sections.map((section, index) => (
          <SidebarSection
            key={index}
            title={section.title}
            items={section.items}
          />
        ))}
      </nav>
      
      {/* Main Content */}
      <main className="main-content">
        {renderActivePage()}
      </main>
    </div>
  );
};

export default Sidebar;
