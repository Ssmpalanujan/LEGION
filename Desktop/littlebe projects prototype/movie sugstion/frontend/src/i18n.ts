import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import si from './locales/si.json'
import ta from './locales/ta.json'

const stored = localStorage.getItem('cm_lang') || 'en'

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ta: { translation: ta }, si: { translation: si } },
  lng: stored,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLang(code: string) {
  localStorage.setItem('cm_lang', code)
  void i18n.changeLanguage(code)
}

export default i18n
