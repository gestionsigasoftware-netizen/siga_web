import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import es from './locales/es.json'
import en from './locales/en.json'
import pt from './locales/pt.json'

// Arranca en 3 idiomas (es/en/pt) -- por ahora solo InicioPublico.jsx tiene
// claves reales bajo "inicio"; el resto de la app sigue con texto fijo en
// español hasta que se traduzca pantalla por pantalla. "common" ya queda
// listo para reutilizarse (nav, pie de página, selector de tema/idioma)
// cuando el resto de la app adopte i18n.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      pt: { translation: pt },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en', 'pt'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'sigap:idioma',
    },
    interpolation: { escapeValue: false },
  })

export default i18n
