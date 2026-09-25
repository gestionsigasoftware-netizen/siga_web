import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Footer from '../components/Footer'
import EmptyStreetIllustration from '../components/illustrations/EmptyStreetIllustration'

export default function NotFound() {
  const { t } = useTranslation()
  return <main className="min-h-screen bg-[#f4f1eb] text-ink px-5 sm:px-8 py-6 flex flex-col">
    <div className="max-w-md mx-auto flex-1 flex flex-col items-center justify-center text-center gap-4 py-16">
      <EmptyStreetIllustration className="w-64 h-auto" />
      <p className="eyebrow">{t('common.notFound.eyebrow')}</p>
      <h1 className="text-3xl font-semibold">{t('common.notFound.titulo')}</h1>
      <p className="text-sm text-secondary">{t('common.notFound.subtitulo')}</p>
      <div className="flex gap-3 mt-2">
        <Link to="/" className="btn-primary">{t('common.notFound.irInicio')}</Link>
        <Link to="/login" className="btn-secondary">{t('common.notFound.iniciarSesion')}</Link>
      </div>
    </div>
    <Footer />
  </main>
}
