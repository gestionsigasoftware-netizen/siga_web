import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import InfoTip from "../components/InfoTip";

const comitesNacionalCache = new Map();

const ALLOWED_LEVELS = ["nacional", "super_admin"];

export default function ComitesNacional() {
  const { t } = useTranslation();
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const [distritos, setDistritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!rolPrincipal || !ALLOWED_LEVELS.includes(rolPrincipal.nivel)) return;
    const cacheKey = "global";
    const cached = comitesNacionalCache.get(cacheKey);
    if (cached) {
      setDistritos(cached.distritos);
      setLoading(false);
    } else {
      setLoading(true);
    }
    supabase.rpc("resumen_comites_nacional").then(({ data, error: rpcError }) => {
      if (rpcError) setError(t('comitesNacional.loadError'));
      const nuevosDistritos = data ?? [];
      setDistritos(nuevosDistritos);
      setLoading(false);
      comitesNacionalCache.set(cacheKey, { distritos: nuevosDistritos });
    });
  }, [rolPrincipal]);

  if (roleLoading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('comitesNacional.validandoPermisos')}</div>;
  if (!ALLOWED_LEVELS.includes(rolPrincipal?.nivel)) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{t('comitesNacional.soloNacional')}</p>;
  if (loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('comitesNacional.cargando')}</div>;

  const sumar = (campo) => distritos.reduce((total, item) => total + Number(item[campo] || 0), 0);
  const columnas = [
    ["escuela_dominical_ninos", t('sidebar.nav.escuelaDominical'), t('comitesNacional.desc.escuelaDominical')],
    ["damas_dorcas_beneficiarias", t('sidebar.nav.damasDorcas'), t('comitesNacional.desc.damasDorcas')],
    ["obra_carcelaria_internos", t('sidebar.nav.obraCarcelaria'), t('comitesNacional.desc.obraCarcelaria')],
    ["musica_integrantes", t('sidebar.nav.musica')],
    ["artistica_integrantes", t('sidebar.nav.educacionArtistica')],
    ["teologica_integrantes", t('sidebar.nav.educacionTeologica')],
    ["conquistadores_miembros", t('sidebar.nav.conquistadores')],
    ["obra_social_casos", t('sidebar.nav.obraSocial'), t('comitesNacional.desc.obraSocial')],
    ["mision_juvenil_estudiantes", t('sidebar.nav.misionJuvenil')],
    ["red_familias_casos", t('sidebar.nav.redFamilias'), t('comitesNacional.desc.redFamilias')],
  ];

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">{t('comitesNacional.eyebrow')}</p>
        <h1 className="section-title">{t('comitesNacional.titulo')}</h1>
        <p className="text-sm text-secondary mt-0.5">{t('comitesNacional.subtitulo')}</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {columnas.map(([campo, label, desc]) => (
          <div key={campo} className="stat-tile">
            <p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">{label}{desc && <InfoTip texto={desc} />}</p>
            <p className="text-2xl font-semibold mt-3">{sumar(campo)}</p>
          </div>
        ))}
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">{t('comitesNacional.porDistrito')}</h2>
          <p className="text-sm text-secondary mt-1">{t('comitesNacional.porDistritoSubtitulo')}</p>
        </div>
        {distritos.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t('comitesNacional.sinDistritos')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-4 py-2.5 whitespace-nowrap">{t('comitesNacional.colDistrito')}</th>
                  {columnas.map(([campo, label]) => <th key={campo} className="font-normal px-4 py-2.5 whitespace-nowrap">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {distritos.map((item) => (
                  <tr key={item.distrito_id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">{item.numero ? t('comitesNacional.distritoLabel', { numero: item.numero }) : null}</td>
                    {columnas.map(([campo]) => <td key={campo} className="px-4 py-2.5">{item[campo]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
