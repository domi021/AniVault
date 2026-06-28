import { useLanguageStore } from '@/src/store/languageStore';
import { getTranslations } from '@/src/i18n';
import type { Translations } from '@/src/i18n';

export function useTranslation(): Translations {
  const lang = useLanguageStore((s) => s.language);
  return getTranslations(lang);
}
