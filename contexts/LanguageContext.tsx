'use client'
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { fetchLanguages } from '@/lib/api';

export type Language = 'ru' | 'en' | 'am';

export type LanguageOption = {
  code: Language;
  label: string;
  native: string;
  flag: string;
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  languages: LanguageOption[];
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'user_language';

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: 'ru', label: 'Русский', native: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', native: 'English', flag: '🇺🇸' },
  { code: 'am', label: 'Հայերեն', native: 'Հայերեն', flag: '🇦🇲' },
];

const LANGUAGE_MAP = DEFAULT_LANGUAGES.reduce((acc, lang) => {
  acc[lang.code] = lang;
  return acc;
}, {} as Record<Language, LanguageOption>);

const normalizeLanguageCode = (value?: string | null): Language | null => {
  if (!value) return null;
  const raw = value.toLowerCase();
  if (raw.includes('ru') || raw.includes('рус')) return 'ru';
  if (raw.includes('en') || raw.includes('eng')) return 'en';
  if (raw.includes('am') || raw.includes('arm') || raw.includes('հայ')) return 'am';
  return null;
};

// Формат списка языков отличается между эндпоинтами — приводим к единому виду.
const normalizeLanguageList = (input: unknown): LanguageOption[] => {
  if (!Array.isArray(input)) return DEFAULT_LANGUAGES;
  const byCode = new Map<Language, LanguageOption>();

  for (const item of input) {
    if (typeof item === 'string') {
      const code = normalizeLanguageCode(item);
      if (code && !byCode.has(code)) {
        byCode.set(code, LANGUAGE_MAP[code]);
      }
      continue;
    }

    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const rawCode = String(
        record.code ||
        record.language ||
        record.id ||
        record.short ||
        record.name ||
        ''
      );
      const code = normalizeLanguageCode(rawCode);
      if (!code) continue;

      const fallback = LANGUAGE_MAP[code];
      const label = typeof record.name === 'string' ? record.name : fallback.label;
      const native = typeof record.native === 'string' || typeof record.native_name === 'string'
        ? String(record.native || record.native_name)
        : fallback.native;
      if (!byCode.has(code)) {
        byCode.set(code, {
          code,
          label,
          native,
          flag: fallback.flag,
        });
      }
    }
  }

  if (byCode.size === 0) {
    return DEFAULT_LANGUAGES;
  }

  for (const fallback of DEFAULT_LANGUAGES) {
    if (!byCode.has(fallback.code)) {
      byCode.set(fallback.code, fallback);
    }
  }

  return Array.from(byCode.values());
};

const translations: Record<Language, Record<string, string>> = {
  ru: {
    'nav.home': 'Главная',
    'nav.subscription': 'Подписка',
    'nav.invite': 'Пригласить',
    'nav.raffle': 'Розыгрыш',
    'sidebar.settings': 'Настройки',
    'nav.locations': 'Локации',
    'nav.devices': 'Устройства',
    'sidebar.support': 'Поддержка',
    'nav.help': 'Помощь',
    'nav.install': 'Установка',
    'balance.title': 'Ваш баланс',
    'balance.deposit': 'Пополнить',
    'actions.invite': 'Пригласить',
    'actions.history': 'История',
    'actions.more': 'Ещё',
    'promo.raffle_title': '🎄 Новогодний розыгрыш!',
    'promo.raffle_subtitle': 'Участвуй и выиграй iPhone, iPad Air, AirPods Pro 3!',
    'promo.locations_title': 'Новые локации доступны!',
    'promo.locations_subtitle': 'Казахстан, Турция, Франция, США (Майами)',
    'promo.invite_title': 'Приглашайте друзей!',
    'promo.invite_subtitle': 'Получите {amount} за каждого подключившегося пользователя',
    'promo.xhttp_title': 'XHTTP уже доступен!',
    'promo.xhttp_subtitle': 'Работает там, где не работает остальное',
    'setup.title': 'Установка и настройка',
    'setup.subtitle': 'Перейти к настройке',
    'setup.button': 'Начать',
    'setup.header_title': 'Настройка устройства',
    'setup.step_os': 'ОС',
    'setup.step_app': 'Приложение',
    'setup.step_subscription': 'Подписка',
    'setup.step_done': 'Готово',
    'setup.os_title': 'Выберите операционную систему',
    'setup.os_subtitle': 'На каком устройстве вы хотите настроить доступ?',
    'setup.app_title': 'Выберите приложение',
    'setup.app_subtitle': 'Рекомендуемые приложения для вашей системы',
    'setup.install_title': 'Установка и подключение',
    'setup.install_subtitle': 'Следуйте инструкциям для завершения настройки',
    'setup.download_app': 'Скачайте приложение',
    'setup.download_desc': 'Нажмите для загрузки приложения',
    'setup.download': 'Скачать',
    'setup.add_subscription': 'Добавьте подписку',
    'setup.subscription_desc': 'Нажмите на кнопку или скопируйте ссылку',
    'setup.copy_hint': 'Нажмите для копирования',
    'setup.add_button': 'Добавить подписку',
    'setup.continue': 'Продолжить',
    'setup.success_title': 'Отлично!',
    'setup.success_message': 'Доступ успешно настроен на вашем устройстве.<br>Теперь вы можете безопасно пользоваться интернетом.',
    'setup.need_help': 'Нужна помощь?',
    'setup.help_text': 'Если у вас возникли сложности с настройкой или подключением, наша служба поддержки готова помочь вам.',
    'setup.finish': 'Готово',
    'setup.contact_support': 'Написать в поддержку',
    'setup.recommended': 'Рекомендуем',
    'setup.instructions_available': 'Инструкция доступна',
    'setup.detailed_instructions': 'Подробная инструкция по настройке',
    'setup.available_in_docs': 'доступна в нашей документации',
    'setup.go_to_instructions': 'Перейти к инструкции',
    'setup.ios_desc': 'iPhone и iPad',
    'setup.android_desc': 'Смартфоны и планшеты',
    'setup.windows_desc': 'Windows 10 и 11',
    'setup.macos_desc': 'Mac компьютеры',
    'setup.linux_desc': 'Ubuntu, Debian',
    'setup.tvos_desc': 'tvOS устройства',
    'setup.androidtv_desc': 'Android телевизоры',
    'setup.app_simple': 'Простое и удобное приложение',
    'setup.app_singbox': 'Приложение на ядре SingBox',
    'setup.app_backup': 'Резервное приложение',
    'setup.app_for': '{app} для {os}',
    'setup.instructions_for': 'Подробная инструкция по настройке {os}',
    'setup.app_native_mac': 'Нативное приложение для Mac',
    'management.title': 'Управление',
    'management.locations': 'Локации',
    'management.device_limit': 'Лимит устройств',
    'management.change': 'Изменить',
    'management.selected': 'Выбрано: {value}',
    'management.not_selected': 'Не настроено',
    'management.devices_count': '{count} устройств',
    'locations.header_title': 'Выбор локаций',
    'locations.hero_title': 'Выберите локации',
    'locations.hero_subtitle': 'Подключайтесь к серверам в нужных вам странах',
    'locations.select_at_least_one': 'Выберите хотя бы одну локацию',
    'locations.selected_count_one': 'Выбрана {count} локация',
    'locations.selected_count_few': 'Выбрано {count} локации',
    'locations.selected_count_many': 'Выбрано {count} локаций',
    'locations.selected_count': 'Выбрано {count} локаций',
    'locations.pricing_title': 'Расчет стоимости',
    'locations.base_tariff': 'Базовый тариф',
    'locations.selected_locations': 'Выбранные локации',
    'locations.locations_cost': 'Стоимость локаций',
    'locations.total_monthly': 'Итого в месяц',
    'locations.save_button': 'Сохранить выбор',
    'locations.info_note': 'Минимум одна локация • Можно изменить позже',
    'locations.unknown_location': 'Неизвестно',
    'subscription.hero_title': 'Ссылки для подключения',
    'subscription.hero_subtitle': 'Используйте эти ссылки для добавления в приложение на устройстве',
    'subscription.global_title': 'Ссылка на подписку',
    'subscription.global_desc': 'Прямой доступ',
    'subscription.mirror_title': 'Зеркало',
    'subscription.mirror_desc': 'Доступ для России',
    'subscription.vless_title': 'VLESS-ключ',
    'subscription.vless_desc': 'Для подключения через ключ',
    'subscription.add_to': 'Добавить в...',
    'subscription.actions_menu_aria': 'Открыть меню действий',
    'common.more': 'Ещё',
    'common.copy': 'Скопировать',
    'common.copied': 'Скопировано!',
    'common.close_menu': 'Закрыть меню',
    'common.unavailable': 'Недоступно',
    'common.auth_required_subscriptions': 'Для доступа к ссылкам требуется авторизация',
    'common.in_development': 'в разработке',
    'common.loading': 'Загрузка данных...',
    'common.error_prefix': 'Ошибка',
    'common.check_token': 'Пожалуйста, проверьте токен авторизации',
    'common.auth_required': 'Для доступа к данным требуется авторизация',
    'common.add_token': 'Пожалуйста, добавьте токен в localStorage с ключом "user_token"',
    'auth.title': 'С возвращением',
    'auth.subtitle': 'Войдите в свой аккаунт',
    'auth.username': 'Username',
    'auth.username_placeholder': 'Введите username',
    'auth.password': 'Password',
    'auth.password_placeholder': 'Введите пароль',
    'auth.sign_in': 'Войти',
    'auth.signing_in': 'Вход...',
    'auth.or': 'или',
    'auth.no_account': 'Нет аккаунта?',
    'auth.register': 'Регистрация',
    'auth.login_error': 'Ошибка входа',
    'auth.telegram_error': 'Ошибка Telegram авторизации',
    'auth.username_id_hint': 'Введите числовой user_id (временный способ входа)',
    'auth.token': 'Токен',
    'auth.token_placeholder': 'Вставьте токен',
    'auth.use_token': 'Войти по токену',
    'auth.token_required': 'Введите токен',
    'referral.header_title': 'Пригласить друзей',
    'referral.hero_title': 'Приглашайте друзей и зарабатывайте!',
    'referral.hero_subtitle': 'Получите до {amount} за каждого друга',
    'referral.total_earned': 'Всего заработано',
    'referral.invited': 'Приглашенные',
    'referral.connected': 'Подключившиеся',
    'referral.your_link': 'Ваша реферальная ссылка',
    'referral.share_button': 'Поделиться',
    'referral.share_telegram': 'Отправить в Telegram',
    'referral.copy_link': 'Скопировать ссылку',
    'referral.referrals_title': 'Рефералы',
    'referral.no_referrals': 'У вас нет рефералов',
    'referral.user': 'Пользователь',
    'referral.status_connected': 'Подключен',
    'referral.status_invited': 'Приглашен',
    'referral.link_not_found': 'Ссылка не найдена',
    'referral.share_message': '🎁 Подключайся к Opengater и получи {bonus} на баланс!\n\n💰 Выгодные условия:\n• Бонус {bonus} сразу после регистрации\n• Кэшбэк до 10% от каждой покупки\n• Реферальная программа\n\n🔗 Твоя персональная ссылка:',
    'toast.link_loading': 'Ссылка еще загружается',
    'toast.link_copied': 'Ссылка скопирована!',
    'toast.link_copied_share': 'Ссылка скопирована! Отправьте её друзьям',
    'profile.language': 'Язык',
    'profile.currency': 'Валюта',
    'profile.theme.dark': 'Тёмная тема',
    'profile.theme.light': 'Светлая тема',
    'profile.logout': 'Выйти',
    'profile.subscription_active': 'Активна',
    'profile.subscription_inactive': 'Не активна',
    'profile.subscription_expired': 'Истекла',
    'profile.copy_id': 'ID скопирован',
    'profile.edit_profile': 'Профиль',
    'profile.profile_page_title': 'Профиль',
    'profile.auth_methods': 'Способы авторизации',
    'profile.add_email_btn': 'Добавить email',
    'profile.change_email': 'Изменить',
    'profile.telegram_linked': 'Telegram привязан',
    'profile.add_telegram': 'Добавить Telegram',
    'language.name': 'Русский',
    'days.expired': 'Истекла',
    'days.expires_today': 'Сегодня истекает',
    'days.remaining': '≈ {count} дней',
    'days.remaining_one': '≈ {count} день',
    'days.remaining_few': '≈ {count} дня',
    'devices.page_title': 'Лимит устройств',
    'devices.hero_title': 'Лимит устройств',
    'devices.hero_subtitle': 'Подключайте больше устройств к одной подписке',
    'devices.current_tariff': 'Текущий тариф',
    'devices.per_month': 'в месяц',
    'devices.plan_starter': 'Стартовый',
    'devices.plan_optimal': 'Оптимальный',
    'devices.plan_family': 'Семейный',
    'devices.plan_team': 'Команда',
    'devices.plan_custom': 'Тариф',
    'devices.popular': 'Популярно',
    'devices.devices_plural': 'устройств',
    'devices.device_single': 'устройство',
    'devices.device_one': 'устройство',
    'devices.device_few': 'устройства',
    'devices.savings_28': 'Выгода 28%',
    'devices.custom_label': 'Свое кол-во устройств',
    'devices.custom_placeholder': 'Введите кол-во от 2 до 100',
    'devices.pricing_title': 'Расчет стоимости',
    'devices.selected_devices': 'Выбрано устройств',
    'devices.discount_28': 'Скидка 28%',
    'devices.total_monthly': 'Итого в месяц',
    'devices.update_button': 'Обновить тариф',
    'devices.info_privacy': 'Не храним данные о ваших устройствах',
    'devices.info_how_works': 'Как это работает?',
    'help.title': 'Центр помощи',
    'help.hero_title': 'Как мы можем помочь?',
    'help.hero_subtitle': 'Найдите ответы на популярные вопросы о сервисе',
    'help.quick_links': 'Полезные ссылки',
    'help.pricing': 'Тарифы и цены',
    'help.instructions': 'Инструкции по настройке',
    'help.privacy': 'Политика конфиденциальности',
    'help.cta_title': 'Не нашли ответ?',
    'help.cta_description': 'Наша команда поддержки готова помочь вам!',
    'help.contact_support': 'Написать в поддержку',
    'help.faq_q1': 'Как настроить VPN на моем устройстве?',
    'help.faq_q2': 'Какие способы оплаты доступны?',
    'help.faq_q3': 'Сколько устройств можно подключить?',
    'help.faq_q4': 'Как изменить локацию сервера?',
    'help.faq_q5': 'Безопасны ли мои данные?',
    'help.faq_q6': 'Как добавить новое устройство?',
    'help.faq_q7': 'Как пригласить друга и получить бонус?',
    'help.faq_a1': 'Перейдите в раздел Установка и следуйте пошаговым инструкциям для вашего устройства. Мы поддерживаем iOS, Android, Windows, macOS и другие платформы.',
    'help.faq_a2': 'Мы принимаем банковские карты (Visa, Mastercard, Мир), систему быстрых платежей СБП, криптовалюты (Bitcoin, USDT, Ethereum) и электронные кошельки (YooMoney, QIWI, WebMoney).',
    'help.faq_a3': 'Количество устройств зависит от вашего тарифного плана. Вы можете проверить и изменить лимит устройств в разделе Управление.',
    'help.faq_a4': 'Вы можете изменить локации серверов в разделе Локации. Выберите страны, к которым хотите подключаться из списка, подтвердите выбор. Далее в приложении обновите или добавьте заново вашу подписку и новые локации будут доступны.',
    'help.faq_a5': 'Да, мы используем современные протоколы шифрования для защиты ваших данных. Мы не храним логи вашей активности.',
    'help.faq_a6': 'Скопируйте ссылку в разделе "Подписка" и передайте ее любым удобным вам способом на новое устройство. На новом устройстве установите приложение, скопируйте пересланную ссылку и вставьте ее в приложение через буфер обмена.',
    'help.faq_a7': 'В личном кабинете перейдите в раздел «Пригласить друзей» → Скопируйте ссылку и отправьте другу. Бонус начисляется в течение часа после того, как приглашённый зарегистрировался по вашей ссылке, настроил доступ и подключился. Если вы столкнулись со сложностями, то обратитесь в поддержку.',
  },
  en: {
    'nav.home': 'Home',
    'nav.subscription': 'Subscription',
    'nav.invite': 'Invite',
    'nav.raffle': 'Raffle',
    'sidebar.settings': 'Settings',
    'nav.locations': 'Locations',
    'nav.devices': 'Devices',
    'sidebar.support': 'Support',
    'nav.help': 'Help',
    'nav.install': 'Install',
    'balance.title': 'Your balance',
    'balance.deposit': 'Top up',
    'actions.invite': 'Invite',
    'actions.history': 'History',
    'actions.more': 'More',
    'promo.raffle_title': '🎄 New Year Raffle!',
    'promo.raffle_subtitle': 'Participate and win iPhone, iPad Air, AirPods Pro 3!',
    'promo.locations_title': 'New locations available!',
    'promo.locations_subtitle': 'Kazakhstan, Turkey, France, USA (Miami)',
    'promo.invite_title': 'Invite friends!',
    'promo.invite_subtitle': 'Get {amount} for each connected user',
    'promo.xhttp_title': 'XHTTP is now available!',
    'promo.xhttp_subtitle': 'Works where nothing else does',
    'setup.title': 'Installation and setup',
    'setup.subtitle': 'Go to setup',
    'setup.button': 'Start',
    'setup.header_title': 'Device setup',
    'setup.step_os': 'OS',
    'setup.step_app': 'App',
    'setup.step_subscription': 'Subscription',
    'setup.step_done': 'Done',
    'setup.os_title': 'Select operating system',
    'setup.os_subtitle': 'Which device do you want to set up?',
    'setup.app_title': 'Choose application',
    'setup.app_subtitle': 'Recommended apps for your system',
    'setup.install_title': 'Installation and connection',
    'setup.install_subtitle': 'Follow the instructions to complete setup',
    'setup.download_app': 'Download the app',
    'setup.download_desc': 'Click to download the application',
    'setup.download': 'Download',
    'setup.add_subscription': 'Add subscription',
    'setup.subscription_desc': 'Click the button or copy the link',
    'setup.copy_hint': 'Click to copy',
    'setup.add_button': 'Add subscription',
    'setup.continue': 'Continue',
    'setup.success_title': 'Ready to go!',
    'setup.success_message': 'Your device is now protected.<br>Enjoy safe and private browsing!',
    'setup.need_help': 'Need help?',
    'setup.help_text': 'If you have difficulties with setup or connection, our support team is ready to help you.',
    'setup.finish': 'Done',
    'setup.contact_support': 'Contact support',
    'setup.recommended': 'Recommended',
    'setup.instructions_available': 'Instructions available',
    'setup.detailed_instructions': 'Detailed setup instructions for',
    'setup.available_in_docs': 'are available in our documentation',
    'setup.go_to_instructions': 'Go to instructions',
    'setup.ios_desc': 'iPhone and iPad',
    'setup.android_desc': 'Smartphones and tablets',
    'setup.windows_desc': 'Windows 10 and 11',
    'setup.macos_desc': 'Mac computers',
    'setup.linux_desc': 'Ubuntu, Debian',
    'setup.tvos_desc': 'tvOS devices',
    'setup.androidtv_desc': 'Android TVs',
    'setup.app_simple': 'Simple and convenient app',
    'setup.app_singbox': 'SingBox-based application',
    'setup.app_backup': 'Backup application',
    'setup.app_for': '{app} for {os}',
    'setup.instructions_for': 'Detailed instructions for {os} setup',
    'setup.app_native_mac': 'Native app for Mac',
    'management.title': 'Management',
    'management.locations': 'Locations',
    'management.device_limit': 'Device limit',
    'management.change': 'Change',
    'management.selected': 'Selected: {value}',
    'management.not_selected': 'Not set',
    'management.devices_count': '{count} devices',
    'locations.header_title': 'Select locations',
    'locations.hero_title': 'Choose locations',
    'locations.hero_subtitle': 'Connect to servers in the countries you need',
    'locations.select_at_least_one': 'Select at least one location',
    'locations.selected_count_one': 'Selected {count} location',
    'locations.selected_count_few': 'Selected {count} locations',
    'locations.selected_count_many': 'Selected {count} locations',
    'locations.selected_count': 'Selected {count} locations',
    'locations.pricing_title': 'Pricing summary',
    'locations.base_tariff': 'Base tariff',
    'locations.selected_locations': 'Selected locations',
    'locations.locations_cost': 'Locations cost',
    'locations.total_monthly': 'Total per month',
    'locations.save_button': 'Save selection',
    'locations.info_note': 'At least one location • You can change later',
    'locations.unknown_location': 'Unknown',
    'subscription.hero_title': 'Connection links',
    'subscription.hero_subtitle': 'Use these links to add to the app on your device',
    'subscription.global_title': 'Subscription link',
    'subscription.global_desc': 'Direct access',
    'subscription.mirror_title': 'Mirror',
    'subscription.mirror_desc': 'Access for Russia',
    'subscription.vless_title': 'VLESS key',
    'subscription.vless_desc': 'For connecting via key',
    'subscription.add_to': 'Add to...',
    'subscription.actions_menu_aria': 'Open actions menu',
    'common.more': 'More',
    'common.copy': 'Copy',
    'common.copied': 'Copied!',
    'common.close_menu': 'Close menu',
    'common.unavailable': 'Unavailable',
    'common.auth_required_subscriptions': 'Authorization is required to access links',
    'common.in_development': 'in development',
    'common.loading': 'Loading data...',
    'common.error_prefix': 'Error',
    'common.check_token': 'Please check your auth token',
    'common.auth_required': 'Authorization is required to access data',
    'common.add_token': 'Please add a token to localStorage with key "user_token"',
    'auth.title': 'Welcome back',
    'auth.subtitle': 'Sign in to your account',
    'auth.username': 'Username',
    'auth.username_placeholder': 'Enter your username',
    'auth.password': 'Password',
    'auth.password_placeholder': 'Enter your password',
    'auth.sign_in': 'Sign In',
    'auth.signing_in': 'Signing in...',
    'auth.or': 'or',
    'auth.no_account': 'Don\'t have an account?',
    'auth.register': 'Register',
    'auth.login_error': 'Login failed',
    'auth.telegram_error': 'Telegram auth failed',
    'auth.username_id_hint': 'Enter numeric user_id (temporary login)',
    'auth.token': 'Token',
    'auth.token_placeholder': 'Paste token',
    'auth.use_token': 'Use token',
    'auth.token_required': 'Enter token',
    'referral.header_title': 'Invite friends',
    'referral.hero_title': 'Invite friends and earn!',
    'referral.hero_subtitle': 'Get up to {amount} for each friend',
    'referral.total_earned': 'Total earned',
    'referral.invited': 'Invited',
    'referral.connected': 'Connected',
    'referral.your_link': 'Your referral link',
    'referral.share_button': 'Share',
    'referral.share_telegram': 'Send to Telegram',
    'referral.copy_link': 'Copy link',
    'referral.referrals_title': 'Referrals',
    'referral.no_referrals': 'You have no referrals',
    'referral.user': 'User',
    'referral.status_connected': 'Connected',
    'referral.status_invited': 'Invited',
    'referral.link_not_found': 'Link not found',
    'referral.share_message': '🎁 Join Opengater and get {bonus} on your balance!\n\n💰 Benefits:\n• {bonus} bonus after registration\n• Referral program\n\n🔗 Your personal link:',
    'toast.link_loading': 'Link is still loading',
    'toast.link_copied': 'Link copied!',
    'toast.link_copied_share': 'Link copied! Send it to friends',
    'profile.language': 'Language',
    'profile.currency': 'Currency',
    'profile.theme.dark': 'Dark theme',
    'profile.theme.light': 'Light theme',
    'profile.logout': 'Log out',
    'profile.subscription_active': 'Active',
    'profile.subscription_inactive': 'Inactive',
    'profile.subscription_expired': 'Expired',
    'profile.copy_id': 'ID copied',
    'profile.edit_profile': 'Profile',
    'profile.profile_page_title': 'Profile',
    'profile.auth_methods': 'Authorization methods',
    'profile.add_email_btn': 'Add email',
    'profile.change_email': 'Change',
    'profile.telegram_linked': 'Telegram linked',
    'profile.add_telegram': 'Add Telegram',
    'language.name': 'English',
    'days.expired': 'Expired',
    'days.expires_today': 'Expires today',
    'days.remaining': '≈ {count} days',
    'days.remaining_one': '≈ {count} day',
    'days.remaining_few': '≈ {count} days',
    'devices.page_title': 'Device limit',
    'devices.hero_title': 'Device limit',
    'devices.hero_subtitle': 'Connect more devices to one subscription',
    'devices.current_tariff': 'Current plan',
    'devices.per_month': 'per month',
    'devices.plan_starter': 'Starter',
    'devices.plan_optimal': 'Optimal',
    'devices.plan_family': 'Family',
    'devices.plan_team': 'Team',
    'devices.plan_custom': 'Plan',
    'devices.popular': 'Popular',
    'devices.devices_plural': 'devices',
    'devices.device_single': 'device',
    'devices.device_one': 'device',
    'devices.device_few': 'devices',
    'devices.savings_28': 'Save 28%',
    'devices.custom_label': 'Custom number of devices',
    'devices.custom_placeholder': 'Enter a number from 2 to 100',
    'devices.pricing_title': 'Pricing summary',
    'devices.selected_devices': 'Selected devices',
    'devices.discount_28': '28% discount',
    'devices.total_monthly': 'Total per month',
    'devices.update_button': 'Update plan',
    'devices.info_privacy': 'We do not store data about your devices',
    'devices.info_how_works': 'How does it work?',
    'help.title': 'Help Center',
    'help.hero_title': 'How can we help?',
    'help.hero_subtitle': 'Find answers to popular questions about the service',
    'help.quick_links': 'Useful Links',
    'help.pricing': 'Pricing',
    'help.instructions': 'Setup Instructions',
    'help.privacy': 'Privacy Policy',
    'help.cta_title': 'Still need help?',
    'help.cta_description': 'Our support team is ready to help you!',
    'help.contact_support': 'Contact Support',
    'help.faq_q1': 'How do I set up VPN on my device?',
    'help.faq_q2': 'What payment methods are available?',
    'help.faq_q3': 'How many devices can I connect?',
    'help.faq_q4': 'How do I change server location?',
    'help.faq_q5': 'Is my data secure?',
    'help.faq_q6': 'How do I add a new device?',
    'help.faq_q7': 'How do I invite a friend and get a bonus?',
    'help.faq_a1': 'Go to the Setup section and follow the step-by-step instructions for your device. We support iOS, Android, Windows, macOS, and more.',
    'help.faq_a2': 'We accept bank cards (Visa, Mastercard, Mir), SBP fast payment system, cryptocurrencies (Bitcoin, USDT, Ethereum), and e-wallets (YooMoney, QIWI, WebMoney).',
    'help.faq_a3': 'The number of devices depends on your subscription plan. You can check and change your device limit in the Management section.',
    'help.faq_a4': 'You can change server locations in the Locations section. Select the countries you want to connect to from the available list.',
    'help.faq_a5': 'Yes, we use modern encryption protocols to protect your data. We do not store logs of your activity.',
    'help.faq_a6': 'Copy the link in the "Subscription" section and send it to your new device in any convenient way. On the new device, install the app, copy the forwarded link and paste it into the app from the clipboard.',
    'help.faq_a7': 'In your account, go to the "Invite Friends" section → Copy the link and send it to a friend. The bonus is credited within an hour after the invitee registers via your link, sets up access and connects. If you encounter any difficulties, contact support.',
  },
  am: {
    'actions.history': "Պատմություն",
    'actions.invite': "Հրավիրել",
    'actions.more': "Ավելին",
    'balance.deposit': "Լրացնել",
    'balance.title': "Ձեր մնացորդը",
    'devices.current_tariff': "Ներկայիս սակագին",
    'devices.custom_label': "Սարքերի սեփական քանակություն",
    'devices.custom_placeholder': "Մուտքագրեք քանակությունը 2-ից 100 մինչև",
    'devices.devices_plural': "սարքեր",
    'devices.discount_28': "Զեղչ 28%",
    'devices.hero_subtitle': "Միացրեք ավելի շատ սարքեր մեկ բաժանորդագրությանը",
    'devices.hero_title': "Սարքերի սահմանափակում",
    'devices.info_how_works': "Ինչպե՞ս է աշխատում",
    'devices.info_privacy': "Մենք չենք պահում ձեր սարքերի տվյալները",
    'devices.page_title': "Սարքերի սահմանափակում",
    'devices.per_month': "ամիսը",
    'devices.plan_family': "Ընտանեկան",
    'devices.plan_optimal': "Օպտիմալ",
    'devices.plan_starter': "Նախնական",
    'devices.plan_team': "Թիմ",
    'devices.popular': "Տարածված",
    'devices.pricing_title': "Արժեքի հաշվարկ",
    'devices.savings_28': "Խնայում 28%",
    'devices.selected_devices': "Ընտրված սարքեր",
    'devices.total_monthly': "Ընդամենը ամսական",
    'devices.update_button': "Թարմացնել պլանը",
    'help.contact_support': "Գրել աջակցությանը",
    'help.cta_description': "Մեր աջակցման թիմը պատրաստ է օգնել ձեզ",
    'help.cta_title': "Չգտա՞ք պատասխանը",
    'help.faq_a1': "Գնացեք Տեղադրման բաժին և հետևեք քայլ առ քայլ ցուցումներին ձեր սարքի համար: Մենք աջակցում ենք iOS, Android, Windows, macOS և այլ պլատֆորմներ:",
    'help.faq_a2': "Մենք ընդունում ենք բանկային քարտեր (Visa, Mastercard, Mir), արագ վճարումների համակարգ ԱՎՀ, կրիպտոարժույթներ (Bitcoin, USDT, Ethereum) և էլեկտրոնային դրամապանակներ (YooMoney, QIWI, WebMoney):",
    'help.faq_a3': "Սարքերի քանակությունը կախված է ձեր սակագնային պլանից: Դուք կարող եք ստուգել և փոխել սարքերի սահմանափակումը Կառավարման բաժնում:",
    'help.faq_a4': "Դուք կարող եք փոխել սերվերների տեղակայությունները Տեղակայություններ բաժնում: Ընտրեք երկրները, որոնց ուզում եք միանալ հասանելի ցուցակից:",
    'help.faq_a5': "Այո, մենք օգտագործում ենք ժամանակակից գաղտնագրման պրոտոկոլներ ձեր տվյալների պաշտպանության համար: Մենք չենք պահում ձեր գործունեության գրառումները:",
    'help.faq_q1': "Ինչպե՞ս կարգավորել մուտքը իմ սարքում",
    'help.faq_q2': "Ինչ վճարման եղանակներ են հասանելի",
    'help.faq_q3': "Քանի՞ սարք կարող եմ միացնել",
    'help.faq_q4': "Ինչպե՞ս փոխել սերվերի տեղակայությունը",
    'help.faq_q5': "Ապահո՞վ են իմ տվյալները",
    'help.hero_subtitle': "Գտեք պատասխաններ ծառայության մասին հաճախակի հարցերին",
    'help.hero_title': "Ինչպե՞ս կարող ենք օգնել",
    'help.instructions': "Կարգավորման ցուցումներ",
    'help.pricing': "Սակագներ և գներ",
    'help.privacy': "Գաղտնիության քաղաքականություն",
    'help.quick_links': "Օգտակար հղումներ",
    'help.title': "Օգնության կենտրոն",
    'locations.base_tariff': "Հիմնական սակագին",
    'locations.header_title': "Տեղակայությունների ընտրություն",
    'locations.hero_subtitle': "Միացեք ձեզ անհրաժեշտ երկրների սերվերներին",
    'locations.hero_title': "Ընտրեք տեղակայությունները",
    'locations.info_note': "Նվազագույնը մեկ տեղակայություն • Կարող է փոխվել ավելի ուշ",
    'locations.locations_cost': "Տեղակայությունների արժեքը",
    'locations.pricing_title': "Արժեքի հաշվարկ",
    'locations.save_button': "Պահպանել ընտրությունը",
    'locations.select_at_least_one': "Ընտրեք առնվազն մեկ տեղակայություն",
    'locations.selected_count': "Ընտրված է {count} տեղակայություն",
    'locations.selected_locations': "Ընտրված տեղակայություններ",
    'locations.total_monthly': "Ընդամենը ամսական",
    'management.change': "Փոխել",
    'management.device_limit': "Սարքերի սահմանափակում",
    'management.devices_count': "{count} սարք",
    'management.locations': "Տեղակայություններ",
    'management.not_selected': "Ընտրված չէ",
    'management.selected': "Ընտրված՝ {value}",
    'management.title': "Կառավարում",
    'nav.devices': "Սարքեր",
    'nav.help': "Օգնություն",
    'nav.home': "Գլխավոր",
    'nav.install': "Տեղադրում",
    'nav.invite': "Հրավիրել",
    'nav.locations': "Տեղակայություններ",
    'nav.subscription': "Բաժանորդագրություն",
    'profile.currency': "Արժույթ",
    'profile.language': "Լեզու",
    'profile.logout': "Ելք",
    'profile.subscription_active': "Ակտիվ",
    'profile.subscription_expired': "Ավարտվել է",
    'profile.copy_id': "ID-ն պատճենվել է",
    'profile.edit_profile': "Պրոֆիլ",
    'profile.profile_page_title': "Պրոֆիլ",
    'profile.auth_methods': "Մուտքի եղանակներ",
    'profile.add_email_btn': "Ավելացնել email",
    'profile.change_email': "Փոխել",
    'profile.telegram_linked': "Telegram-ը կապված է",
    'profile.add_telegram': "Ավելացնել Telegram",
    'promo.locations_title': "Նոր տեղակայություններ հասանելի են!",
    'promo.locations_subtitle': "Ղազախստան, Թուրքիա, Ֆրանսիա, ԱՄՆ (Մայամի)",
    'promo.invite_subtitle': "Ստացեք {amount} յուրաքանչյուր միացված օգտատերի համար",
    'promo.invite_title': "Հրավիրեք ընկերներին!",
    'promo.xhttp_subtitle': "Աշխատում է այնտեղ, որտեղ մնացածները չեն աշխատում",
    'promo.xhttp_title': "XHTTP արդեն հասանելի է!",
    'referral.connected': "Միացած",
    'referral.copy_link': "Պատճենել հղումը",
    'referral.header_title': "Հրավիրել ընկերներին",
    'referral.hero_subtitle': "Ստացեք մինչև {amount} յուրաքանչյուր ընկերոջ համար",
    'referral.hero_title': "Հրավիրեք ընկերներին և վաստակեք",
    'referral.invited': "Հրավիրված",
    'referral.link_not_found': "Հղումը չի գտնվել",
    'referral.no_referrals': "Դուք ռեֆերալներ չունեք",
    'referral.referrals_title': "Ռեֆերալներ",
    'referral.share_button': "Կիսվել",
    'referral.share_message': "🎁 Միացեք Opengater-ին և ստացեք {bonus} ձեր մնացորդին!\n\n💰 Ձեռնտու պայմաններ:\n• {bonus} բոնուս գրանցումից հետո\n• Կաշբեք մինչև 10% յուրաքանչյուր գնումից\n• Ռեֆերալ ծրագիր\n\n🔗 Ձեր անձնական հղումը՝",
    'referral.share_telegram': "Ուղարկել Telegram-ին",
    'referral.status_connected': "Միացած",
    'referral.status_invited': "Հրավիրված",
    'referral.total_earned': "Ընդամենը վաստակված",
    'referral.user': "Օգտվող",
    'referral.your_link': "Ձեր ռեֆերալ հղումը",
    'setup.add_button': "Ավելացնել բաժանորդագրությունը",
    'setup.add_subscription': "Ավելացնել բաժանորդագրությունը",
    'setup.android_desc': "Սմարթֆոններ և պլանշետներ",
    'setup.androidtv_desc': "Android հեռուստացույցներ",
    'setup.app_backup': "Պահուստային հավելված",
    'setup.app_for': "{app}-ը {os}-ի համար",
    'setup.app_native_mac': "Տեղական հավելված Mac-ի համար",
    'setup.app_simple': "Պարզ և հարմար հավելված",
    'setup.app_singbox': "SingBox հիմքով հավելված",
    'setup.app_subtitle': "Առաջարկվող հավելվածներ ձեր համակարգի համար",
    'setup.app_title': "Ընտրեք հավելվածը",
    'setup.available_in_docs': "հասանելի է մեր փաստաթղթերում",
    'setup.button': "Սկսել",
    'setup.contact_support': "Գրել աջակցությանը",
    'setup.continue': "Շարունակել",
    'setup.copy_hint': "Սեղմեք պատճենելու համար",
    'setup.detailed_instructions': "Մանրամասն ցուցումը կարգավորման համար",
    'setup.download': "Բեռնել",
    'setup.download_app': "Բեռնեք հավելվածը",
    'setup.download_desc': "Սեղմեք հավելվածը բեռնելու համար",
    'setup.finish': "Պատրաստ",
    'setup.go_to_instructions': "Անցնել ցուցումին",
    'setup.header_title': "Սարքի կարգավորում",
    'setup.help_text': "Եթե դուք դժվարություններ ունեք կարգավորման կամ կապի հետ, մեր աջակցման ծառայությունը պատրաստ է օգնել ձեզ:",
    'setup.install_subtitle': "Հետևեք ցուցումներին կարգավորումն ավարտելու համար",
    'setup.install_title': "Տեղադրում և կապում",
    'setup.instructions_available': "Ցուցում հասանելի է",
    'setup.instructions_for': "Մանրամասն ցուցումը {os} կարգավորման համար",
    'setup.ios_desc': "iPhone և iPad",
    'setup.linux_desc': "Ubuntu, Debian",
    'setup.macos_desc': "Mac համակարգիչներ",
    'setup.need_help': "Օգնության կարի՞ք ունեք",
    'setup.os_subtitle': "Որ սարքում եք ուզում կարգավորել մուտքը",
    'setup.os_title': "Ընտրեք գործառնական համակարգը",
    'setup.recommended': "Առաջարկվող",
    'setup.step_app': "Հավելված",
    'setup.step_done': "Պատրաստ",
    'setup.step_os': "ՕՀ",
    'setup.step_subscription': "Բաժանորդագրություն",
    'setup.subscription_desc': "Սեղմեք կոճակը կամ պատճենեք հղումը",
    'setup.subtitle': "Անցնել կարգավորմանը",
    'setup.success_message': "Մուտքը հաջողությամբ կարգավորված է ձեր սարքում:<br>Հիմա կարող եք անվտանգ օգտագործել ինտերնետը:",
    'setup.success_title': "Հրաշալի",
    'setup.title': "Տեղադրում և կարգավորում",
    'setup.tvos_desc': "tvOS սարքեր",
    'setup.windows_desc': "Windows 10 և 11",
    'sidebar.settings': "Կարգավորումներ",
    'sidebar.support': "Աջակցություն",
    'subscription.hero_subtitle': "Օգտագործեք այս հղումներն ավելացնելու սարքի հավելվածում",
    'subscription.hero_title': "Կապի հղումներ",
    'toast.link_copied': "Հղումը պատճենվեց",
    'toast.link_copied_share': "Հղումը պատճենվեց: Ուղարկեք ընկերներին",
    'toast.link_loading': "Հղումը դեռ բեռնվում է",
    'auth.login_error': "Մուտքի սխալ",
    'auth.telegram_error': "Telegram մուտքի սխալ",
    'auth.token_required': "Մուտքագրեք թոքենը",
    'common.add_token': "Խնդրում ենք ավելացնել թոքենը localStorage-ում \"user_token\" բանալով",
    'common.auth_required': "Տվյալներին հասանելիության համար անհրաժեշտ է մուտք",
    'common.auth_required_subscriptions': "Հղումներին հասանելիության համար անհրաժեշտ է մուտք",
    'common.check_token': "Խնդրում ենք ստուգել ձեր աութենտիկացիայի թոքենը",
    'common.close_menu': "Փակել մենյուն",
    'common.copied': "Պատճենվեց!",
    'common.copy': "Պատճենել",
    'common.error_prefix': "Սխալ",
    'common.in_development': "զարգացման փուլում",
    'common.loading': "Բեռնվում է...",
    'common.more': "Ավելին",
    'common.unavailable': "Անհասանելի",
    'days.expired': "Ավարտվել է",
    'days.expires_today': "Այսօր ավարտվում է",
    'days.remaining': "≈ {count} օր",
    'days.remaining_few': "≈ {count} օր",
    'days.remaining_one': "≈ {count} օր",
    'devices.device_few': "սարքեր",
    'devices.device_one': "սարք",
    'devices.device_single': "սարք",
    'language.name': "Հայերեն",
    'locations.selected_count_few': "Ընտրված են {count} տեղակայություններ",
    'locations.selected_count_many': "Ընտրված են {count} տեղակայություններ",
    'locations.selected_count_one': "Ընտրված է {count} տեղակայություն",
    'locations.unknown_location': "Անհայտ տեղակայություն",
    'nav.raffle': "Խաղարկություն",
    'profile.subscription_inactive': "Ակտիվ չէ",
    'profile.theme.dark': "Մութ թեմա",
    'profile.theme.light': "Լուսավոր թեմա",
    'promo.raffle_subtitle': "Մասնակցեք և շահեք iPhone, iPad Air, AirPods Pro 3!",
    'promo.raffle_title': "🎄 Նոր տարվա խաղարկություն!",
    'subscription.actions_menu_aria': "Բացել գործողությունների մենյուն",
    'subscription.add_to': "Ավելացնել...",
    'subscription.global_desc': "Ուղիղ մուտք",
    'subscription.global_title': "Բաժանորդագրության հղում",
    'subscription.mirror_desc': "Մուտք Ռուսաստանի համար",
    'subscription.mirror_title': "Հայելի",
    'subscription.vless_desc': "Մուտքի համար բանալի",
    'subscription.vless_title': "VLESS բանալի",
  },
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('ru');
  const [languages, setLanguages] = useState<LanguageOption[]>(DEFAULT_LANGUAGES);

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(LANGUAGE_STORAGE_KEY)) || '';
    const normalized = normalizeLanguageCode(saved);
    if (normalized) {
      setLanguageState(normalized);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadLanguages = async () => {
      try {
        // Предпочитаем список из API, но при ошибках откатываемся к дефолтам.
        const apiLanguages = await fetchLanguages();
        if (!mounted) return;
        setLanguages(normalizeLanguageList(apiLanguages));
      } catch {
        if (!mounted) return;
        setLanguages(DEFAULT_LANGUAGES);
      }
    };
    loadLanguages();
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  };

  const toggleLanguage = () => {
    const order: Language[] = ['ru', 'en', 'am'];
    const index = order.indexOf(language);
    const next = order[(index + 1) % order.length];
    setLanguage(next);
  };

  const t = useMemo(() => {
    const dict = translations[language];
    return (key: string, params?: Record<string, string | number>) => {
      // Если ключ не найден — берем RU как fallback и подставляем параметры.
      const template = dict[key] || translations.ru[key] || key;
      if (!params) return template;
      return Object.entries(params).reduce((acc, [k, v]) => {
        return acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }, template);
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, languages, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};



