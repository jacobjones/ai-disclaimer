export const SUPPORTED_LOCALES = ['en', 'de', 'fr']

export const DISCLAIMER_TRANSLATIONS = {
  '6a8fe45342cbe42b3725398f': {
    en: 'Created with AI assistance',
    de: 'Mit KI-Unterstützung erstellt',
    fr: 'Créé avec l\'aide de l\'IA',
  },
  '6a8fe45342cbe42b37253991': {
    en: 'Generated using AI',
    de: 'Mit KI generiert',
    fr: 'Généré à l\'aide de l\'IA',
  },
  '6a8fe45342cbe42b3725398e': {
    en: 'Materially modified using AI',
    de: 'Wesentlich mit KI verändert',
    fr: 'Modifié de manière substantielle à l\'aide de l\'IA',
  },
  '6a9ac74a4f2e104e55c87272': {
    en: 'AI-generated. This depiction is not real.',
    de: 'KI-generiert. Diese Darstellung ist nicht real.',
    fr: 'Généré par l\'IA. Cette représentation n\'est pas réelle.',
  },
}

export const LOCALE_LABELS = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
}

export function getDisclaimerText(choiceId, locale = 'en') {
  const translations = DISCLAIMER_TRANSLATIONS[choiceId]
  if (!translations) {
    return null
  }
  return translations[locale] || translations.en
}
