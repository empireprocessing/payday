import { notFound } from 'next/navigation';

export type Locale = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl' | 'he';

const dictionaries = {
  fr: () => import('../dictionaries/fr.json').then(module => module.default),
  en: () => import('../dictionaries/en.json').then(module => module.default),
  es: () => import('../dictionaries/es.json').then(module => module.default),
  // Pour les autres langues, on fallback sur l'anglais pour l'instant
  de: () => import('../dictionaries/en.json').then(module => module.default),
  it: () => import('../dictionaries/it.json').then(module => module.default),
  pt: () => import('../dictionaries/en.json').then(module => module.default),
  nl: () => import('../dictionaries/en.json').then(module => module.default),
  he: () => import('../dictionaries/he.json').then(module => module.default),
};

export async function getDictionary(locale: Locale) {
  try {
    return await dictionaries[locale]();
  } catch (error) {
    notFound();
  }
}

export function isValidLocale(locale: string): locale is Locale {
  return ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'he'].includes(locale);
}