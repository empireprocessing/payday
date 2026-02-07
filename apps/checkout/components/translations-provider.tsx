'use client';

import { createContext, useContext } from 'react';

type Dictionary = any; // Type simplifié pour l'instant

interface TranslationsContextType {
  dictionary: Dictionary;
  locale: string;
}

const TranslationsContext = createContext<TranslationsContextType | undefined>(undefined);

export function TranslationsProvider({ 
  children, 
  dictionary,
  locale 
}: { 
  children: React.ReactNode;
  dictionary: Dictionary;
  locale: string;
}) {
  return (
    <TranslationsContext.Provider value={{ dictionary, locale }}>
      {children}
    </TranslationsContext.Provider>
  );
}

export function useTranslations() {
  const context = useContext(TranslationsContext);
  if (!context) {
    throw new Error('useTranslations must be used within TranslationsProvider');
  }
  
  const { dictionary } = context;
  
  // Fonction helper pour accéder aux traductions avec dot notation
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = dictionary;
    
    for (const k of keys) {
      value = value?.[k];
      if (!value) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    return value;
  };
  
  return { t, locale: context.locale };
}

// Hook pour remplacer les variables dans les chaînes
export function useFormattedTranslation() {
  const { t } = useTranslations();
  
  const ft = (key: string, values?: Record<string, string>) => {
    let translation = t(key);
    
    if (values && typeof translation === 'string') {
      Object.entries(values).forEach(([k, v]) => {
        translation = translation.replace(new RegExp(`{{${k}}}`, 'g'), v);
      });
    }
    
    return translation;
  };
  
  return ft;
}