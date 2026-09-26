import { useEffect, useMemo, useState } from "react";
import { Download, Search, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import InfoTip from "../components/InfoTip";
import { descargarPdf } from "../lib/reportExport";
import { ETIQUETA_TRIMESTRE, limitesInformeTrimestral, trimestreCerradoMasReciente } from "../lib/trimestre";

const gestionPastoralNacionalCache = new Map();

const ALLOWED_LEVELS = ["nacional", "super_admin"];

function Metric({ label, value, detail, tip }) {
  return (
    <div className="stat-tile">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">{label}{tip && <InfoTip texto={tip} />}</p>
      <p className="text-2xl font-semibold mt-3">{value}</p>
      {detail && <p className="text-xs text-muted mt-1">{detail}</p>}
    </div>
  );
}

function OtorgarAccesoJerarquico({ esSuperAdmin, distritos }) {
  const { t } = useTranslation();
  function formatDistritoLabel(nombre, numero) {
    return numero ? t('gestionPastoralNacional.distritoLabel', { numero }) : null;
  }
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [nivel, setNivel] = useState("distrital");
  const [distritoId, setDistritoId] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!message || message.type !== "success") return undefined;
    const timer = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (searchTerm.trim().length < 2 || selectedPerson) { setResults([]); return undefined; }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const term = searchTerm.trim();
      const { data } = await supabase
        .from("personas")
        .select("id, nombres, apellidos, congregaciones(nombre)")
        .or(`nombres.ilike.%${term}%,apellidos.ilike.%${term}%`)
        .order("nombres")
        .limit(15);
      if (active) { setResults(data ?? []); setSearching(false); }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [searchTerm, selectedPerson]);

  function selectPerson(person) {
    setSelectedPerson(person);
    setSearchTerm(`${person.nombres} ${person.apellidos}`);
    setResults([]);
  }

  async function otorgar(event) {
    event.preventDefault();
    if (!selectedPerson || !email.trim() || (nivel === "distrital" && !distritoId)) {
      setMessage({ type: "error", text: t('gestionPastoralNacional.otorgar.errorSeleccionar') });
      return;
    }
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke("otorgar-acceso-jerarquico", {
      body: { personId: selectedPerson.id, nivel, distritoId: nivel === "distrital" ? distritoId : null, email: email.trim() },
    });
    setSaving(false);
    if (error) {
      let serverMessage = "";
      if (error.context) {
        try { const body = await error.context.json(); serverMessage = body?.error || ""; } catch { /* sin cuerpo JSON */ }
      }
      setMessage({ type: "error", text: serverMessage || t('gestionPastoralNacional.otorgar.errorGenerico') });
      return;
    }
    if (!data?.ok) { setMessage({ type: "error", text: t('gestionPastoralNacional.otorgar.errorConfirmar') }); return; }
    setSelectedPerson(null);
    setSearchTerm("");
    setEmail("");
    setDistritoId("");
    setMessage({
      type: "success",
      text: data.yaTeniaAcceso
        ? t('gestionPastoralNacional.otorgar.yaTeniaAcceso')
        : data.invitationSent
          ? t('gestionPastoralNacional.otorgar.accesoInvitacion')
          : t('gestionPastoralNacional.otorgar.accesoExistente'),
    });
  }

  return (
    <section className="card p-5">
      <div className="flex items-center gap-3 mb-1"><UserPlus className="w-5 h-5 text-accent" /><h2 className="font-medium">{t('gestionPastoralNacional.otorgar.titulo')}</h2></div>
      <p className="text-sm text-secondary mb-4">{t('gestionPastoralNacional.otorgar.subtitulo', { oNacional: esSuperAdmin ? t('gestionPastoralNacional.otorgar.oNacional') : '' })}</p>
      <form onSubmit={otorgar} className="grid sm:grid-cols-2 gap-3">
        <div className="relative sm:col-span-2">
          <label className="text-sm">{t('gestionPastoralNacional.otorgar.persona')}
            <div className="relative mt-1.5">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setSelectedPerson(null); }} placeholder={t('gestionPastoralNacional.otorgar.escribeNombre')} className="input-field pl-9" />
            </div>
          </label>
          {searchTerm.trim().length >= 2 && !selectedPerson && (
            <div className="absolute z-10 w-full mt-1 bg-surface-2 border border-border rounded-card shadow-lg max-h-56 overflow-y-auto">
              {searching ? <p className="p-3 text-xs text-muted">{t('gestionPastoralNacional.otorgar.buscando')}</p> : results.length === 0 ? <p className="p-3 text-xs text-muted">{t('gestionPastoralNacional.otorgar.sinResultados')}</p> : results.map((person) => (
                <button type="button" key={person.id} onClick={() => selectPerson(person)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-1">
                  {person.nombres} {person.apellidos} <span className="text-xs text-muted">· {person.congregaciones?.nombre || t('gestionPastoralNacional.otorgar.sinCongregacion')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="text-sm"><span className="flex items-center gap-1">{t('gestionPastoralNacional.otorgar.nivelOtorgar')}<InfoTip texto={t('gestionPastoralNacional.otorgar.nivelTip')} /></span><select className="input-field mt-1.5" value={nivel} onChange={(event) => setNivel(event.target.value)}><option value="distrital">{t('gestionPastoralNacional.otorgar.distrital')}</option>{esSuperAdmin && <option value="nacional">{t('gestionPastoralNacional.otorgar.nacional')}</option>}</select></label>
        {nivel === "distrital" && <label className="text-sm">{t('gestionPastoralNacional.otorgar.distrito')}<select required className="input-field mt-1.5" value={distritoId} onChange={(event) => setDistritoId(event.target.value)}><option value="">{t('gestionPastoralNacional.otorgar.seleccionar')}</option>{distritos.map((distrito) => <option key={distrito.distrito_id} value={distrito.distrito_id}>{formatDistritoLabel(distrito.nombre, distrito.numero)}</option>)}</select></label>}
        <label className="text-sm sm:col-span-2 flex items-center gap-1">{t('gestionPastoralNacional.otorgar.correoAcceso')}<InfoTip texto={t('gestionPastoralNacional.otorgar.correoTip')} /><input required type="email" className="input-field mt-1.5 w-full" placeholder="persona@correo.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button disabled={saving || !selectedPerson} className="btn-primary justify-center sm:w-fit sm:col-span-2">{saving ? t('gestionPastoralNacional.otorgar.otorgando') : t('gestionPastoralNacional.otorgar.otorgarAcceso')}</button>
      </form>
      {message && <p role={message.type === "error" ? "alert" : "status"} className={`text-sm mt-3 ${message.type === "error" ? "text-danger" : "text-success"}`}>{message.text}</p>}
    </section>
  );
}

export default function GestionPastoralNacional() {
  const { t } = useTranslation();
  const INFORME_SORT_LABELS = t('gestionPastoralNacional.sortLabels', { returnObjects: true });
  function formatDistritoLabel(nombre, numero) {
    return numero ? t('gestionPastoralNacional.distritoLabel', { numero }) : null;
  }
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const [distritos, setDistritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const informeTrimestralCerrado = trimestreCerradoMasReciente();
  const [informeAnio, setInformeAnio] = useState(informeTrimestralCerrado.anio);
  const [informeTrimestre, setInformeTrimestre] = useState(informeTrimestralCerrado.trimestre);
  const [resumenInformeTrimestral, setResumenInformeTrimestral] = useState([]);
  const [loadingInformeTrimestral, setLoadingInformeTrimestral] = useState(true);
  const [informeSortKey, setInformeSortKey] = useState("bautizados_nuevos");
  const filasInformeOrdenadas = useMemo(
    () => [...resumenInformeTrimestral].sort((a, b) => Number(b[informeSortKey] || 0) - Number(a[informeSortKey] || 0)),
    [resumenInformeTrimestral, informeSortKey]
  );

  async function descargarInformeTrimestralNacional() {
    if (!filasInformeOrdenadas.length) return;
    const etiqueta = `${ETIQUETA_TRIMESTRE[informeTrimestre]} ${informeAnio}`;
    const sumar = (campo) => filasInformeOrdenadas.reduce((total, item) => total + Number(item[campo] || 0), 0);
    await descargarPdf({
      filename: `informe-trimestral-nacional-${informeAnio}-t${informeTrimestre}.pdf`,
      titulo: t('gestionPastoralNacional.export.tituloReporte', { etiqueta }),
      orientacion: "landscape",
      meta: [t('gestionPastoralNacional.export.nivelNacional'), t('gestionPastoralNacional.export.trimestreLabel', { etiqueta }), t('gestionPastoralNacional.export.ordenadoPor', { campo: INFORME_SORT_LABELS[informeSortKey] })],
      resumen: {
        kpis: [
          { label: t('gestionPastoralNacional.export.bautizadosPais'), value: sumar("bautizados_nuevos") },
          { label: t('gestionPastoralNacional.export.selladosPais'), value: sumar("sellados_nuevos") },
          { label: t('gestionPastoralNacional.export.reconciliadosPais'), value: sumar("reconciliados_actual") },
          { label: t('gestionPastoralNacional.export.entregadosPais'), value: sumar("entregados_nuevos") },
        ],
      },
      headers: [t('gestionPastoralNacional.colDistrito'), t('gestionPastoralNacional.export.colCongregaciones'), t('gestionPastoralNacional.export.colBautizados'), t('gestionPastoralNacional.export.colNuevos'), t('gestionPastoralNacional.export.colSellados'), t('gestionPastoralNacional.export.colNuevos'), t('gestionPastoralNacional.export.colReconciliados'), t('gestionPastoralNacional.export.colAntes'), t('gestionPastoralNacional.export.colEntregados'), t('gestionPastoralNacional.export.colNuevos')],
      rows: filasInformeOrdenadas.map((item) => [
        formatDistritoLabel(item.nombre, item.numero),
        item.congregaciones,
        item.bautizados_total_actual, item.bautizados_nuevos,
        item.sellados_total_actual, item.sellados_nuevos,
        item.reconciliados_actual, item.reconciliados_anterior,
        item.entregados_total_actual, item.entregados_nuevos,
      ]),
    });
  }

  useEffect(() => {
    if (!rolPrincipal || !ALLOWED_LEVELS.includes(rolPrincipal.nivel)) return;
    const cacheKey = "global";
    const cached = gestionPastoralNacionalCache.get(cacheKey);
    if (cached) {
      setDistritos(cached.distritos);
      setLoading(false);
    } else {
      setLoading(true);
    }
    supabase.rpc("resumen_pastoral_nacional").then(({ data, error: rpcError }) => {
      if (rpcError) setError(t('gestionPastoralNacional.errorCargar'));
      const nuevosDistritos = data ?? [];
      setDistritos(nuevosDistritos);
      setLoading(false);
      gestionPastoralNacionalCache.set(cacheKey, { distritos: nuevosDistritos });
    });
  }, [rolPrincipal]);

  // Aparte del cache de arriba -- depende de un rango de fechas que cambia
  // con el selector de trimestre, no del cache global sin parametros.
  useEffect(() => {
    if (!rolPrincipal || !ALLOWED_LEVELS.includes(rolPrincipal.nivel)) return;
    setLoadingInformeTrimestral(true);
    supabase
      .rpc("resumen_informe_trimestral_nacional", limitesInformeTrimestral(informeAnio, informeTrimestre))
      .then(({ data, error: rpcError }) => {
        setLoadingInformeTrimestral(false);
        if (rpcError) { setError(t('gestionPastoralNacional.errorCargarInforme')); setResumenInformeTrimestral([]); return; }
        setResumenInformeTrimestral(data ?? []);
      });
  }, [rolPrincipal, informeAnio, informeTrimestre]);

  if (roleLoading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('gestionPastoralNacional.validandoPermisos')}</div>;
  if (!ALLOWED_LEVELS.includes(rolPrincipal?.nivel)) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{t('gestionPastoralNacional.soloNacional')}</p>;
  if (loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t('gestionPastoralNacional.cargando')}</div>;

  const sumar = (campo) => distritos.reduce((total, item) => total + Number(item[campo] || 0), 0);
  const totalObrero = sumar("pastores_obrero");
  const totalLocal = sumar("pastores_local");
  const totalGeneral = sumar("pastores_general");
  const totalOrdenacion = sumar("pastores_ordenacion");
  const totalPastores = totalObrero + totalLocal + totalGeneral + totalOrdenacion;
  const totalVacantes = sumar("congregaciones_vacantes");
  const totalCargosVacantes = sumar("cargos_vacantes");

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">{t('gestionPastoralNacional.eyebrow')}</p>
        <h1 className="section-title">{t('gestionPastoralNacional.titulo')}</h1>
        <p className="text-sm text-secondary mt-0.5">{t('gestionPastoralNacional.subtitulo')}</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <OtorgarAccesoJerarquico esSuperAdmin={rolPrincipal?.nivel === "super_admin"} distritos={distritos} />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label={t('gestionPastoralNacional.pastoresPais')} value={totalPastores} detail={t('gestionPastoralNacional.ordenados', { cantidad: totalOrdenacion })} />
        <Metric label={t('gestionPastoralNacional.congregacionesVacantes')} value={totalVacantes} tip={t('gestionPastoralNacional.congregacionesVacantesTip')} />
        <Metric label={t('gestionPastoralNacional.cargosVacantes')} value={totalCargosVacantes} detail={t('gestionPastoralNacional.sobre6Cargos')} tip={t('gestionPastoralNacional.cargosVacantesTip')} />
        <Metric label={t('gestionPastoralNacional.distritos')} value={distritos.length} />
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium flex items-center gap-1.5">{t('gestionPastoralNacional.escalafonTitulo')}<InfoTip texto={t('gestionPastoralNacional.escalafonTip')} /></h2>
          <p className="text-sm text-secondary mt-1">{t('gestionPastoralNacional.escalafonSubtitulo')}</p>
        </div>
        {distritos.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t('gestionPastoralNacional.sinDistritos')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colDistrito')}</th>
                  <th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colObrero')}</th>
                  <th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colLicenciaLocal')}</th>
                  <th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colLicenciaGeneral')}</th>
                  <th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colOrdenacion')}</th>
                  <th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colCongVacantes')}</th>
                  <th className="font-normal px-5 py-3"><span className="flex items-center gap-1.5">{t('gestionPastoralNacional.colCargosOcupados')}<InfoTip texto={t('gestionPastoralNacional.colCargosOcupadosTip')} /></span></th>
                </tr>
              </thead>
              <tbody>
                {distritos.map((item) => (
                  <tr key={item.distrito_id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{formatDistritoLabel(item.nombre, item.numero)}</td>
                    <td className="px-5 py-3">{item.pastores_obrero}</td>
                    <td className="px-5 py-3">{item.pastores_local}</td>
                    <td className="px-5 py-3">{item.pastores_general}</td>
                    <td className="px-5 py-3">{item.pastores_ordenacion}</td>
                    <td className={`px-5 py-3 ${Number(item.congregaciones_vacantes) > 0 ? "text-danger" : "text-secondary"}`}>{item.congregaciones_vacantes}</td>
                    <td className={`px-5 py-3 ${Number(item.cargos_vacantes) > 0 ? "text-warning" : "text-secondary"}`}>{t('gestionPastoralNacional.cargosDe6', { cantidad: item.cargos_ocupados })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-medium flex items-center gap-1.5">{t('gestionPastoralNacional.informeTitulo')}<InfoTip texto={t('gestionPastoralNacional.informeTip')} /></h2>
            <p className="text-sm text-secondary mt-1">{t('gestionPastoralNacional.informeSubtitulo')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input-field" value={informeAnio} onChange={(event) => setInformeAnio(Number(event.target.value))}>{[informeTrimestralCerrado.anio, informeTrimestralCerrado.anio - 1, informeTrimestralCerrado.anio - 2].map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select className="input-field" value={informeTrimestre} onChange={(event) => setInformeTrimestre(Number(event.target.value))}>{Object.entries(ETIQUETA_TRIMESTRE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select className="input-field" value={informeSortKey} onChange={(event) => setInformeSortKey(event.target.value)}>
              <option value="bautizados_nuevos">{t('gestionPastoralNacional.ordenarBautizados')}</option>
              <option value="sellados_nuevos">{t('gestionPastoralNacional.ordenarSellados')}</option>
              <option value="reconciliados_actual">{t('gestionPastoralNacional.ordenarReconciliados')}</option>
              <option value="entregados_nuevos">{t('gestionPastoralNacional.ordenarEntregados')}</option>
            </select>
            <button type="button" onClick={descargarInformeTrimestralNacional} disabled={!filasInformeOrdenadas.length} className="btn-secondary"><Download className="w-4 h-4" /> {t('gestionPastoralNacional.descargarPdf')}</button>
          </div>
        </div>
        {loadingInformeTrimestral ? (
          <p className="p-5 text-sm text-muted">{t('gestionPastoralNacional.cargandoInforme')}</p>
        ) : resumenInformeTrimestral.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t('gestionPastoralNacional.sinDatosInforme')}</p>
        ) : (() => {
          const filasOrdenadas = filasInformeOrdenadas;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colDistrito')}</th><th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colCongregaciones')}</th><th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colBautizados')}</th><th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colSellados')}</th><th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colReconciliados')}</th><th className="font-normal px-5 py-3">{t('gestionPastoralNacional.colEntregados')}</th></tr></thead>
                <tbody>
                  {filasOrdenadas.map((item, index) => (
                    <tr key={item.distrito_id} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">{index === 0 && <span className="text-[10px] uppercase tracking-wide text-success mr-1.5">●</span>}{formatDistritoLabel(item.nombre, item.numero)}</td>
                      <td className="px-5 py-3 text-secondary">{item.congregaciones}</td>
                      <td className="px-5 py-3">{item.bautizados_total_actual} <span className="text-xs text-success">(+{item.bautizados_nuevos})</span></td>
                      <td className="px-5 py-3">{item.sellados_total_actual} <span className="text-xs text-success">(+{item.sellados_nuevos})</span></td>
                      <td className="px-5 py-3">{item.reconciliados_actual} <span className="text-xs text-muted">{t('gestionPastoralNacional.antes', { cantidad: item.reconciliados_anterior })}</span></td>
                      <td className="px-5 py-3">{item.entregados_total_actual} <span className="text-xs text-success">{t('gestionPastoralNacional.nuevos', { cantidad: item.entregados_nuevos })}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
