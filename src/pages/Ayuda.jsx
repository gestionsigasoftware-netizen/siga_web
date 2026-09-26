import { ArrowLeft, MailQuestion, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Footer from '../components/Footer'

export default function Ayuda() {
  const { t } = useTranslation()
  const questionGroups = [
    { key: 'grupo1', titulo: t('ayuda.grupo1.titulo'), preguntas: [1, 2, 3, 4, 5, 6].map((n) => [t(`ayuda.grupo1.q${n}.p`), t(`ayuda.grupo1.q${n}.r`)]) },
    { key: 'grupo2', titulo: t('ayuda.grupo2.titulo'), preguntas: [1, 2, 3, 4, 5].map((n) => [t(`ayuda.grupo2.q${n}.p`), t(`ayuda.grupo2.q${n}.r`)]) },
    { key: 'grupo3', titulo: t('ayuda.grupo3.titulo'), preguntas: [1, 2, 3].map((n) => [t(`ayuda.grupo3.q${n}.p`), t(`ayuda.grupo3.q${n}.r`)]) },
  ]
  return <main className="min-h-screen bg-[#f4f1eb] text-ink px-5 sm:px-8 py-6"><div className="max-w-3xl mx-auto"><Link to="/" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-ink"><ArrowLeft className="w-4 h-4" /> {t('ayuda.inicio')}</Link><header className="mt-16"><p className="eyebrow">{t('ayuda.eyebrow')}</p><h1 className="text-4xl font-semibold mt-3">{t('ayuda.titulo')}</h1><p className="text-secondary leading-7 mt-4 max-w-2xl">{t('ayuda.subtitulo')}</p></header><section className="mt-10 flex flex-col gap-8">{questionGroups.map((grupo) => <div key={grupo.key}><h2 className="text-xs uppercase tracking-[0.14em] text-muted mb-3">{grupo.titulo}</h2><div className="grid gap-3">{grupo.preguntas.map(([question, answer]) => <details key={question} className="border border-border rounded-card bg-surface-2 p-5 group"><summary className="font-medium cursor-pointer list-none flex justify-between gap-4">{question}<span className="text-accent group-open:rotate-45 transition-transform">+</span></summary><p className="text-sm text-secondary leading-6 mt-3 max-w-2xl">{answer}</p></details>)}</div></div>)}</section><section id="acceso" className="mt-10 border border-accent/20 rounded-card bg-accent-bg p-6"><MailQuestion className="w-5 h-5 text-accent" /><h2 className="font-medium mt-4">{t('ayuda.acceso.titulo')}</h2><div className="grid sm:grid-cols-2 gap-4 mt-3"><div><p className="text-sm font-medium">{t('ayuda.acceso.yaUsaTitulo')}</p><p className="text-sm text-secondary leading-6 mt-1">{t('ayuda.acceso.yaUsaTexto')}</p></div><div><p className="text-sm font-medium">{t('ayuda.acceso.nuncaTitulo')}</p><p className="text-sm text-secondary leading-6 mt-1">{t('ayuda.acceso.nuncaTexto')}</p></div></div><p className="text-xs text-muted mt-4">{t('ayuda.acceso.nota')}</p></section><div className="flex items-center gap-2 text-xs text-muted mt-10"><ShieldCheck className="w-4 h-4 text-success" /> {t('ayuda.footerNota')}</div></div><Footer /></main>
}
