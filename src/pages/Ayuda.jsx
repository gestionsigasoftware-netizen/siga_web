import { ArrowLeft, MailQuestion, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

const questionGroups = [
  {
    titulo: 'Empezar a usar SIGAP',
    preguntas: [
      ['¿Qué es SIGAP?', 'Es el sistema de gestión pastoral de la IPUC: censo de feligresía, comités, evangelismo y reportes, con una vista adecuada para cada nivel — local, distrital y nacional.'],
      ['¿Cómo obtengo acceso?', 'SIGAP es una aplicación privada. Solicita al pastor o administrador de tu congregación que cree tu acceso y te envíe la invitación por correo.'],
      ['¿Puedo registrarme sin invitación?', 'No. El registro abierto está desactivado para proteger la información de las congregaciones — todo acceso viene de una invitación real.'],
      ['¿Qué hago si olvidé mi contraseña?', 'Usa la opción "¿Olvidaste tu contraseña?" en el inicio de sesión para recibir un enlace de recuperación por correo.'],
      ['¿Puedo usar SIGAP desde el celular?', 'Sí, funciona desde cualquier navegador de celular o computador — no requiere instalar nada.'],
    ],
  },
  {
    titulo: 'Uso diario',
    preguntas: [
      ['¿Por qué no veo un módulo que esperaba?', 'Los módulos dependen de tu congregación, tu nivel (local, distrital, nacional) y el perfil de acceso que te asignaron. Si crees que deberías tenerlo, consulta al administrador de tu congregación.'],
      ['Mi nombre aparece diferente al que esperaba, ¿cómo lo corrijo?', 'Entra a "Mi perfil" (ícono de usuario, arriba a la derecha) y corrige tus Nombres/Apellidos ahí — se actualiza en toda la aplicación, incluido el censo.'],
      ['¿Cómo le doy acceso a otra persona de mi congregación?', 'Desde "Equipo de trabajo" (solo lo ve el pastor), selecciona a la persona en el censo, su correo y el perfil de acceso que necesita.'],
      ['¿Qué pasa si alguien se traslada a otra congregación?', 'Desde la ficha de la persona en Feligresía puedes iniciar un traslado — la congregación que recibe lo confirma, y todo el historial de la persona viaja con ella, no se pierde.'],
      ['¿Cómo me comunico con mi distrital o con nacional?', 'Usa "Solicitudes internas" — es un canal formal (no un chat) para pedir algo, reportar una situación o hacer una sugerencia, con seguimiento de estado hasta que se resuelva.'],
    ],
  },
  {
    titulo: 'Privacidad, datos y soporte técnico',
    preguntas: [
      ['¿Mis datos y los del censo están seguros?', 'Sí — el acceso está protegido por autenticación, cada congregación solo ve su propia información, y los niveles superiores solo ven lo que les corresponde según su alcance. Más detalle en Privacidad y términos.'],
      ['Encontré un error o algo no funciona, ¿qué hago?', 'Una vez tengas acceso, usa "Soporte" dentro de la aplicación para reportarlo — queda registrado y le llega un aviso directo al equipo que mantiene SIGAP. También puedes escribir a soportesigasoftware@gmail.com.'],
      ['¿Qué hago si mi congregación aparece "pendiente de aprobación"?', 'Las congregaciones nuevas las activa el distrital correspondiente desde "Aprobaciones". Si lleva mucho tiempo pendiente, contacta a tu líder distrital.'],
    ],
  },
]

export default function Ayuda() {
  return <main className="min-h-screen bg-[#f4f1eb] text-ink px-5 sm:px-8 py-6"><div className="max-w-3xl mx-auto"><Link to="/" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-ink"><ArrowLeft className="w-4 h-4" /> Inicio</Link><header className="mt-16"><p className="eyebrow">Centro de ayuda</p><h1 className="text-4xl font-semibold mt-3">Respuestas para empezar</h1><p className="text-secondary leading-7 mt-4 max-w-2xl">SIGAP trabaja con accesos autorizados por cada congregación. Aquí encuentras las respuestas más comunes antes de entrar.</p></header><section className="mt-10 flex flex-col gap-8">{questionGroups.map((grupo) => <div key={grupo.titulo}><h2 className="text-xs uppercase tracking-[0.14em] text-muted mb-3">{grupo.titulo}</h2><div className="grid gap-3">{grupo.preguntas.map(([question, answer]) => <details key={question} className="border border-border rounded-card bg-surface-2 p-5 group"><summary className="font-medium cursor-pointer list-none flex justify-between gap-4">{question}<span className="text-accent group-open:rotate-45 transition-transform">+</span></summary><p className="text-sm text-secondary leading-6 mt-3 max-w-2xl">{answer}</p></details>)}</div></div>)}</section><section id="acceso" className="mt-10 border border-accent/20 rounded-card bg-accent-bg p-6"><MailQuestion className="w-5 h-5 text-accent" /><h2 className="font-medium mt-4">¿Necesitas acceso?</h2><p className="text-sm text-secondary leading-6 mt-2">Contacta al responsable de SIGAP en tu congregación. Él podrá registrarte, asignarte el perfil adecuado y enviarte la invitación.</p><p className="text-xs text-muted mt-4">No compartas contraseñas ni solicites que se creen usuarios desde cuentas de terceros.</p></section><div className="flex items-center gap-2 text-xs text-muted mt-10"><ShieldCheck className="w-4 h-4 text-success" /> Tu acceso depende de los permisos asignados a tu cuenta.</div></div></main>
}