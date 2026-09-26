import { BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMiRol } from '../hooks/useMiRol'

// El contenido de este manual (que es/como/pasos por rol) vive en
// src/i18n/locales/{es,en,pt}.json bajo "manual.contenido" y
// "manual.herramientasGenerales" -- se lee completo via
// t(..., { returnObjects: true }) dentro del componente, no como
// constante de modulo (no hay t() disponible fuera de un componente).
function ManualItem({ item }) {
  return (
    <div className="card p-5">
      <h3 className="font-medium">{item.titulo}</h3>
      <p className="text-sm text-secondary leading-6 mt-2">{item.queEs}</p>
      {item.como?.length > 0 && (
        <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border">
          {item.como.map((flujo) => (
            <div key={flujo.accion}>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-accent">{flujo.accion}</p>
              <ol className="list-decimal list-inside text-sm text-secondary leading-6 mt-1.5 flex flex-col gap-1">
                {flujo.pasos.map((paso, index) => <li key={index}>{paso}</li>)}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Manual() {
  const { t } = useTranslation()
  const { rolPrincipal, loading } = useMiRol()

  if (loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('manual.cargando')}</div>

  const nivel = rolPrincipal?.nivel ?? 'local'
  const contenido = t('manual.contenido', { returnObjects: true })
  const herramientasGenerales = t('manual.herramientasGenerales', { returnObjects: true })
  const secciones = contenido[nivel] ?? contenido.local

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">{t('manual.eyebrow', { nivel: t(`sidebar.levels.${nivel}`) })}</p>
        <h1 className="section-title">{t('manual.titulo')}</h1>
        <p className="text-sm text-secondary mt-0.5">{t('manual.subtitulo')}</p>
      </header>

      <div className="flex flex-col gap-8">
        {secciones.map((grupo) => (
          <section key={grupo.seccion}>
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted mb-3">{grupo.seccion}</h2>
            <div className="grid gap-3">
              {grupo.items.map((item) => <ManualItem key={item.titulo} item={item} />)}
            </div>
          </section>
        ))}

        <section>
          <h2 className="text-xs uppercase tracking-[0.14em] text-muted mb-3">{t('manual.herramientasTitulo')}</h2>
          <div className="grid gap-3">
            {herramientasGenerales.map((item) => <ManualItem key={item.titulo} item={item} />)}
          </div>
        </section>
      </div>

      <p className="text-xs text-muted flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> {t('manual.footerAviso')}</p>
    </div>
  )
}
