import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, translations } from './translations';

const LANGUAGE_STORAGE_KEY = 'app_language';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && (saved === 'en' || saved === 'es' || saved === 'pt')) {
        setLanguageState(saved);
      }
    } catch (error) {
      console.error('Failed to load language preference', error);
    } finally {
      setIsReady(true);
    }
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (error) {
      console.error('Failed to save language preference', error);
    }
  };

  const t = (key: string): string => {
    return translations[language]?.[key] ?? key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {isReady ? children : null}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
