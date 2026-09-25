import { ArrowRight, BarChart3, BookOpen, CalendarClock, CalendarRange, Check, Clock, HeartHandshake, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme.jsx'
import sigapLogo from '../assets/sigap-logo.svg'
import sigapLogoWhite from '../assets/sigap-logo-white.svg'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../components/LanguageSwitcher'

// Numero real de SIGAP para cotizar planes -- confirmado por el usuario
// (2026-09-10). No se muestran precios a proposito: la decision de
// negocio fue vender por copywriting + asesoria directa, no por tabla
// de precios publica.
const WHATSAPP_NUMERO = '573005772967'
function enlaceWhatsapp(plan) {
  const mensaje = `Hola, quiero conocer el plan ${plan} de SIGAP para mi congregación.`
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`
}

// Dia = evolucion refinada de la marca ya validada (crema + dorado + azul).
// Noche = modo oscuro real, con un acento en degradado y el diagrama de
// consolidado (Congregacion -> Distrito -> Nacional) en vez de la franja de
// 4 niveles del modo dia -- mismas dos direcciones que se le mostraron al
// usuario como Opcion A / Opcion B, implementadas aqui como un solo
// interruptor real en vez de dos paginas separadas.
export default function InicioPublico() {
  const { user, loading } = useAuth()
  const { theme } = useTheme()
  const { t } = useTranslation()
  const esOscuro = theme === 'dark'
  if (!loading && user) return <Navigate to="/app" replace />

  const modules = [
    { icon: HeartHandshake, title: t('inicio.modules.title1'), text: t('inicio.modules.text1') },
    { icon: BarChart3, title: t('inicio.modules.title2'), text: t('inicio.modules.text2') },
    { icon: BookOpen, title: t('inicio.modules.title3'), text: t('inicio.modules.text3') },
  ]

  const planes = [
    {
      icon: CalendarClock,
      nombre: t('inicio.plans.monthlyName'),
      resumen: t('inicio.plans.monthlySummary'),
      beneficios: [t('inicio.plans.monthlyBenefit1'), t('inicio.plans.monthlyBenefit2'), t('inicio.plans.monthlyBenefit3')],
      cta: t('inicio.plans.monthlyCta'),
      plan: 'mensual',
    },
    {
      icon: CalendarRange,
      nombre: t('inicio.plans.annualName'),
      resumen: t('inicio.plans.annualSummary'),
      destacado: t('inicio.plans.annualBadge'),
      beneficios: [t('inicio.plans.annualBenefit1'), t('inicio.plans.annualBenefit2'), t('inicio.plans.annualBenefit3')],
      cta: t('inicio.plans.annualCta'),
      plan: 'anual',
    },
  ]

  return (
    <main className={esOscuro ? 'min-h-screen bg-[#0B0B0B] text-white' : 'min-h-screen bg-[#f3f0e9] text-ink'}>
      <style>{`
        @keyframes sigap-drift-1 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(46px,32px) scale(1.08); } 100% { transform: translate(0,0) scale(1); } }
        @keyframes sigap-drift-2 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(-38px,-40px) scale(1.06); } 100% { transform: translate(0,0) scale(1); } }
        .sigap-orb-1 { animation: sigap-drift-1 17s ease-in-out infinite; }
        .sigap-orb-2 { animation: sigap-drift-2 21s ease-in-out infinite; }
        @keyframes sigap-flow { to { stroke-dashoffset: -24; } }
        .sigap-flow-line { stroke-dasharray: 6 6; animation: sigap-flow 1.1s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sigap-orb-1, .sigap-orb-2 { animation: none; }
          .sigap-flow-line { animation: none; }
        }
      `}</style>

      <div className="relative min-h-svh flex flex-col overflow-hidden">
        <div
          className="sigap-orb-1 absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full pointer-events-none"
          style={{ background: esOscuro ? '#2A78D6' : '#F0C876', filter: 'blur(100px)', opacity: esOscuro ? 0.32 : 0.55 }}
        />
        <div
          className="sigap-orb-2 absolute top-24 -right-52 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: esOscuro ? '#F0C876' : '#2A78D6', filter: 'blur(110px)', opacity: esOscuro ? 0.22 : 0.4 }}
        />

        <nav className="relative z-[1] w-full max-w-6xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center" aria-label="Inicio de SIGAP">
            <img src={esOscuro ? sigapLogoWhite : sigapLogo} alt="SIGAP" className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-3 sm:gap-4 text-sm">
            <Link to="/ayuda" className={esOscuro ? 'hidden sm:inline text-white/65 hover:text-white' : 'hidden sm:inline text-secondary hover:text-ink'}>{t('common.nav.ayuda')}</Link>
            <LanguageSwitcher dark={esOscuro} />
            <ThemeToggle />
            <Link
              to="/login"
              className={esOscuro
                ? 'inline-flex items-center gap-2 bg-white text-ink px-4 py-2.5 rounded text-sm font-medium hover:opacity-90 transition-all'
                : 'btn-primary'}
            >
              <span>{t('common.nav.ingresar')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </nav>

        <section className="relative z-[1] w-full max-w-6xl mx-auto px-5 sm:px-8 pt-10 lg:pt-14 pb-28 flex-1 grid content-center lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
          <div>
            <div className={`inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${esOscuro ? 'border-white/15 bg-white/5 text-white/80' : 'border-border bg-accent-bg text-accent-dark'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${esOscuro ? 'bg-accent' : 'bg-accent'}`} />
              <span>{t(esOscuro ? 'inicio.hero.eyebrowLive' : 'inicio.hero.eyebrow')}</span>
            </div>
            <h1 className={`leading-[0.98] mt-6 max-w-2xl ${esOscuro ? 'text-5xl sm:text-7xl font-semibold tracking-tight' : 'text-4xl sm:text-6xl font-semibold'}`}>
              {t('inicio.hero.titlePre')}
              <span
                className={esOscuro ? 'bg-clip-text text-transparent' : undefined}
                style={esOscuro ? { backgroundImage: 'linear-gradient(90deg,#8FC8FF,#F0C876)' } : undefined}
              >
                {t('inicio.hero.titleAccent')}
              </span>
              {t('inicio.hero.titlePost')}
            </h1>
            <p className={`text-lg leading-8 mt-6 max-w-xl ${esOscuro ? 'text-white/65' : 'text-secondary'}`}>{t('inicio.hero.subhead')}</p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link
                to="/login"
                className={esOscuro
                  ? 'inline-flex items-center justify-center gap-2 bg-white text-ink px-5 py-3 rounded-lg font-medium shadow-[0_18px_40px_rgba(0,0,0,0.35)] hover:opacity-90 transition-all'
                  : 'btn-primary py-3'}
              >
                <span>{t('inicio.hero.cta')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <p className={`text-xs mt-5 flex items-center gap-2 ${esOscuro ? 'text-white/45' : 'text-muted'}`}>
              <ShieldCheck className={`w-4 h-4 ${esOscuro ? 'text-[#8FC8FF]' : 'text-success'}`} /> {t('inicio.hero.trust')}
            </p>
          </div>
          <div className="relative min-h-[330px] bg-night rounded-card overflow-hidden p-7 sm:p-10 text-white shadow-[0_24px_60px_rgba(21,27,34,0.18)]">
            <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_82%_12%,#2a78d6_0,transparent_35%),linear-gradient(145deg,transparent_40%,#173404_160%)]" />
            <div className="relative h-full flex flex-col justify-between">
              <div><p className="text-xs uppercase tracking-[0.18em] text-white/55">{t('inicio.dashboardMock.yourCongregation')}</p><p className="text-2xl font-medium mt-3">{t('inicio.dashboardMock.sharedReading')}</p></div>
              <div className="grid grid-cols-2 gap-3 mt-10 sm:mt-16">
                <div className="rounded bg-white/10 border border-white/10 p-4">
                  <p className="text-xs text-white/55">{t('inicio.dashboardMock.activity')}</p>
                  <svg className="w-full h-9 mt-3" viewBox="0 0 80 30" fill="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="hero-actividad-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="hero-actividad-line" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#fff" stopOpacity="0.95" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="27" x2="80" y2="27" stroke="#fff" strokeOpacity="0.12" strokeDasharray="1.5 3" />
                    <path d="M1,23 C10,23 13,16 21,16 C29,16 32,20 40,18 C48,16 51,7 59,6 C65,5.2 70,4.4 79,3 L79,30 L1,30 Z" fill="url(#hero-actividad-area)" />
                    <path d="M1,23 C10,23 13,16 21,16 C29,16 32,20 40,18 C48,16 51,7 59,6 C65,5.2 70,4.4 79,3" stroke="url(#hero-actividad-line)" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="79" cy="3" r="4.5" fill="#fff" fillOpacity="0.16" />
                    <circle cx="79" cy="3" r="2" fill="#fff" />
                  </svg>
                  <p className="text-3xl font-semibold mt-3">{t('inicio.dashboardMock.activityValue')}</p>
                  <p className="text-xs text-white/55 mt-1">{t('inicio.dashboardMock.byModule')}</p>
                </div>
                <div className="rounded bg-[#8fca68]/15 border border-[#8fca68]/20 p-4">
                  <p className="text-xs text-white/55">{t('inicio.dashboardMock.accompaniment')}</p>
                  <svg className="w-full h-9 mt-3" viewBox="0 0 80 30" fill="none" aria-hidden="true">
                    <defs>
                      <radialGradient id="hero-acompanamiento-glow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <circle cx="40" cy="15" r="13.5" fill="url(#hero-acompanamiento-glow)" />
                    <circle cx="40" cy="15" r="13" stroke="#fff" strokeOpacity="0.2" />
                    <circle cx="40" cy="15" r="8.5" stroke="#fff" strokeOpacity="0.4" />
                    <circle cx="40" cy="15" r="3.5" fill="#fff" />
                  </svg>
                  <p className="text-3xl font-semibold mt-3">{t('inicio.dashboardMock.accompanimentValue')}</p>
                  <p className="text-xs text-white/55 mt-1">{t('inicio.dashboardMock.byPerson')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {esOscuro ? (
          <section className="relative z-[1] w-full max-w-6xl mx-auto px-5 sm:px-8 pb-20 border-t border-white/10 pt-12">
            <p className="text-xs uppercase tracking-[0.14em] text-white/50 font-semibold text-center mb-4">{t('inicio.rollup.caption')}</p>
            <svg width="100%" height="170" viewBox="0 0 1200 170" className="block">
              <line className="sigap-flow-line" x1="140" y1="85" x2="540" y2="85" stroke="#2A78D6" strokeWidth="2" strokeOpacity="0.65" />
              <line className="sigap-flow-line" x1="640" y1="85" x2="1040" y2="85" stroke="#F0C876" strokeWidth="2" strokeOpacity="0.65" />
              <circle cx="100" cy="85" r="34" fill="rgba(42,120,214,0.14)" stroke="#2A78D6" strokeWidth="1.6" />
              <circle cx="100" cy="85" r="6" fill="#2A78D6" />
              <text x="100" y="146" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="600">{t('inicio.rollup.congregacion')}</text>
              <text x="100" y="164" textAnchor="middle" fill="rgba(255,255,255,0.48)" fontSize="11">{t('inicio.rollup.congregacionDesc')}</text>
              <circle cx="600" cy="85" r="34" fill="rgba(42,120,214,0.14)" stroke="#2A78D6" strokeWidth="1.6" />
              <circle cx="600" cy="85" r="6" fill="#2A78D6" />
              <text x="600" y="146" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="600">{t('inicio.rollup.distrito')}</text>
              <text x="600" y="164" textAnchor="middle" fill="rgba(255,255,255,0.48)" fontSize="11">{t('inicio.rollup.distritoDesc')}</text>
              <circle cx="1100" cy="85" r="34" fill="rgba(240,200,118,0.18)" stroke="#F0C876" strokeWidth="1.6" />
              <circle cx="1100" cy="85" r="6" fill="#F0C876" />
              <text x="1100" y="146" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="600">{t('inicio.rollup.nacional')}</text>
              <text x="1100" y="164" textAnchor="middle" fill="rgba(255,255,255,0.48)" fontSize="11">{t('inicio.rollup.nacionalDesc')}</text>
            </svg>
          </section>
        ) : (
          <section className="relative z-[1] w-full bg-night text-white">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
              <p className="text-xs uppercase tracking-[0.14em] text-[#8FC8FF] font-semibold mb-4">{t('inicio.levels.eyebrow')}</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  [t('inicio.levels.congregacion'), t('inicio.levels.congregacionDesc')],
                  [t('inicio.levels.distrital'), t('inicio.levels.distritalDesc')],
                  [t('inicio.levels.nacional'), t('inicio.levels.nacionalDesc')],
                ].map(([nombre, descripcion]) => (
                  <div key={nombre} className="border border-white/10 bg-white/5 rounded-card p-5 transition-colors hover:border-[#8FC8FF]/50">
                    <p className="font-semibold text-sm text-white">{nombre}</p>
                    <p className="text-xs text-white/65 mt-2">{descripcion}</p>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-2 text-xs text-white/55 mt-6">
                <Clock className="w-4 h-4 text-[#8FC8FF]" />
                {t('inicio.levels.availability')}
              </p>
            </div>
          </section>
        )}
      </div>

      <section className="relative overflow-hidden border-t border-white/10 bg-night text-white">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_15%_20%,rgba(42,120,214,0.28),transparent_38%),radial-gradient(circle_at_85%_80%,rgba(42,120,214,0.2),transparent_42%)]" />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-16 grid md:grid-cols-3 gap-4">{modules.map(({ icon: Icon, title, text }) => <article key={title} className="p-5 border border-white/10 rounded-card bg-[linear-gradient(145deg,rgba(42,120,214,0.3),rgba(42,120,214,0.12))] shadow-[0_14px_30px_rgba(5,12,20,0.18)]"><Icon className="w-5 h-5 text-[#8fc8ff]" /><h2 className="font-medium mt-5">{title}</h2><p className="text-sm text-white/65 leading-6 mt-2">{text}</p></article>)}</div>
      </section>

      <div className={esOscuro ? 'bg-[#0B0B0B]' : 'planes-ambient'}>
        {!esOscuro && (
          <style>{`
            .planes-ambient {
              position: relative;
              overflow: hidden;
              background:
                radial-gradient(ellipse 300px 300px at -6% -20%, rgba(240, 200, 118, 0.8) 0%, rgba(240, 200, 118, 0) 60%),
                radial-gradient(ellipse 1000px 1000px at -16% -30%, rgba(160, 108, 24, 0.3) 0%, rgba(160, 108, 24, 0) 74%),
                radial-gradient(ellipse 300px 300px at 106% 122%, rgba(143, 189, 236, 0.8) 0%, rgba(143, 189, 236, 0) 60%),
                radial-gradient(ellipse 1000px 1000px at 118% 134%, rgba(40, 82, 150, 0.3) 0%, rgba(40, 82, 150, 0) 74%);
            }
          `}</style>
        )}
        <section className="relative z-[1] max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="max-w-2xl">
            <p className={`text-xs uppercase tracking-[0.18em] font-medium ${esOscuro ? 'text-[#8FC8FF]' : 'text-accent'}`}>{t('inicio.plans.eyebrow')}</p>
            <h2 className="text-3xl sm:text-4xl font-semibold leading-tight mt-3">{t('inicio.plans.title')}</h2>
            <p className={`leading-7 mt-4 ${esOscuro ? 'text-white/65' : 'text-secondary'}`}>{t('inicio.plans.subtext')}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mt-10 items-stretch">
            {planes.map(({ icon: Icon, nombre, resumen, destacado, beneficios, cta, plan }) => {
              const oscuroCard = Boolean(destacado) || esOscuro
              return (
                <article
                  key={plan}
                  className={oscuroCard
                    ? 'relative p-8 rounded-card flex flex-col bg-night text-white shadow-[0_28px_64px_rgba(21,27,34,0.28)] ring-1 ring-white/10'
                    : 'card relative p-8 flex flex-col'}
                >
                  {oscuroCard && <div className="absolute inset-0 rounded-card opacity-70 bg-[radial-gradient(circle_at_88%_0%,#2a78d6_0,transparent_42%),radial-gradient(circle_at_2%_100%,rgba(240,200,118,0.4)_0,transparent_48%)]" />}
                  <div className="relative flex flex-col flex-1">
                    {destacado && (
                      <span className="absolute -top-4 right-0 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold bg-[#f0c876] text-[#3d2c05] px-3 py-1.5 rounded-full shadow-[0_8px_18px_rgba(240,200,118,0.38)]">
                        <Sparkles className="w-3 h-3" />{destacado}
                      </span>
                    )}
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${oscuroCard ? 'bg-white/10 text-white ring-1 ring-white/15' : 'bg-accent/10 text-accent'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className={`text-2xl font-semibold mt-6 ${oscuroCard ? 'text-white' : 'text-ink'}`}>{nombre}</h3>
                    <p className={`text-sm leading-6 mt-2 ${oscuroCard ? 'text-white/70' : 'text-secondary'}`}>{resumen}</p>
                    <div className={`h-px w-full mt-6 ${oscuroCard ? 'bg-white/10' : 'bg-border'}`} />
                    <ul className="flex flex-col gap-3.5 mt-6 flex-1">
                      {beneficios.map((beneficio) => (
                        <li key={beneficio} className="text-sm leading-6 flex items-start gap-2.5">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${oscuroCard ? 'bg-white/15 text-white' : 'bg-accent/15 text-accent'}`}>
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                          </span>
                          <span className={oscuroCard ? 'text-white/80' : 'text-secondary'}>{beneficio}</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href={enlaceWhatsapp(plan)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={oscuroCard
                        ? 'inline-flex items-center justify-center gap-2 bg-white text-ink px-4 py-3 rounded text-sm font-medium shadow-[0_10px_24px_rgba(0,0,0,0.25)] hover:opacity-90 transition-all mt-8'
                        : 'btn-primary justify-center mt-8'}
                    >
                      <MessageCircle className="w-4 h-4" /><span>{cta}</span>
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
          <p className={`text-xs mt-6 flex items-center gap-2 ${esOscuro ? 'text-white/45' : 'text-muted'}`}>
            <ShieldCheck className={`w-4 h-4 ${esOscuro ? 'text-[#8FC8FF]' : 'text-success'}`} /> {t('inicio.plans.trust')}
          </p>
        </section>
      </div>

      <footer className={`max-w-6xl mx-auto px-5 sm:px-8 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${esOscuro ? 'border-t border-white/10' : ''}`}>
        <div className={esOscuro ? 'text-white/45' : 'text-muted'}>
          <p className={esOscuro ? 'text-white/70' : 'text-secondary'}>SIGAP — {t('common.footer.line')}</p>
          <p className="mt-1">© {new Date().getFullYear()} {t('common.footer.rights')} · {t('common.footer.by')}</p>
        </div>
        <span className={`flex gap-4 flex-shrink-0 ${esOscuro ? 'text-white/45' : 'text-muted'}`}>
          <Link to="/legal" className={esOscuro ? 'hover:text-white' : 'hover:text-ink'}>{t('common.footer.privacy')}</Link>
          <Link to="/ayuda" className={esOscuro ? 'hover:text-white' : 'hover:text-ink'}>{t('common.footer.help')}</Link>
        </span>
      </footer>
    </main>
  )
}
