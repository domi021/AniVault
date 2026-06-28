import { en } from './en';
import { es } from './es';
import { ja } from './ja';
import type { Language } from '@/src/store/languageStore';

type Translations = typeof en;

const maps: Record<Language, Translations> = { en, es, ja };

export function getTranslations(lang: Language): Translations {
  return maps[lang] || en;
}

export type { Translations };
