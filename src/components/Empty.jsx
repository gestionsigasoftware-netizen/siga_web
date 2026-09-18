import FamilyIllustration from './illustrations/FamilyIllustration'
import TeamIllustration from './illustrations/TeamIllustration'
import NoResultsIllustration from './illustrations/NoResultsIllustration'

// Componente compartido de estado vacío -- antes estaba duplicado igual
// en FeligresiaAdmin.jsx, ObraCarcelaria.jsx y Sepri.jsx. `illustration`
// elige la escena según lo que falta (no siempre la misma imagen):
// 'familia' (familias/censo), 'equipo' (comités/delegados/equipo de
// trabajo), o 'resultados' (genérico -- filtros, búsquedas, listas sin
// datos aún).
const ILUSTRACIONES = { familia: FamilyIllustration, equipo: TeamIllustration, resultados: NoResultsIllustration }

export default function Empty({ text, illustration = 'resultados' }) {
  const Ilustracion = ILUSTRACIONES[illustration] || NoResultsIllustration
  return (
    <div className="p-10 text-center bg-surface-1 rounded-card border border-dashed border-border flex flex-col items-center gap-3">
      <Ilustracion className="w-32 h-auto flex-shrink-0" />
      <p className="text-sm text-secondary max-w-xs">{text}</p>
    </div>
  )
}
