import { useEffect, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { supabase } from "../lib/supabase";
import { fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, distributionDataset, trendDataset } from "../lib/chartTheme";
import ChartEmpty from "../components/ChartEmpty";
import InfoTip from "../components/InfoTip";
import ExportButtons from "../components/ExportButtons";
import GeoMap from "../components/charts/GeoMap";
import MapaTerritorios from "../components/charts/MapaTerritorios";
import { descargarCsv, descargarExcel, descargarPdf } from "../lib/reportExport";
import { hoyBogota } from "../lib/fechaBogota";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const CHART_OPTIONS = chartOptions();

const impactoMisioneroCache = new Map();

function Metric({ label, value, detail, tip }) {
  return (
    <div className="stat-tile">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">{label}{tip && <InfoTip texto={tip} />}</p>
      <p className="text-2xl font-semibold mt-3">{value}</p>
      {detail && <p className="text-xs text-muted mt-1">{detail}</p>}
    </div>
  );
}

export default function ImpactoMisionero() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const nivel = rolPrincipal?.nivel;
  const congregacionId = rolPrincipal?.congregacion_id;
  const esLocal = nivel === "local";
  const esNacionalOSuperAdmin = nivel === "nacional" || nivel === "super_admin";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [radioKm, setRadioKm] = useState(15);

  useEffect(() => {
    if (!rolPrincipal) return;
    if (esLocal && !congregacionId) {
      setLoading(false);
      setError("Tu usuario no tiene una congregación local asignada.");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolPrincipal]);

  async function load() {
    // rolPrincipal.id (la fila de roles_sistema, no congregacionId) --
    // un distrital no tiene congregacion_id, así que una clave basada
    // en nivel+congregacion colisionaba entre distritos distintos si la
    // misma persona tiene varios roles distritales y cambia de rol
    // activo sin recargar la página completa.
    const cacheKey = rolPrincipal.id;
    const cached = impactoMisioneroCache.get(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const desde12m = fechaBogota(new Date(Date.now() - 365 * 86400000));
    // Igual que en los demas fixes de hoy: `scoped` solo distinguia local,
    // dejando distrital sin filtro -- una cuenta multi-rol viendo "como"
    // distrital veia el pais entero etiquetado como "tu distrito". Ahora
    // distrital tambien filtra, via el embed a congregaciones.
    const esDistrital = nivel === "distrital";
    const distritoEmbed = esDistrital ? ", congregaciones!inner(distrito_id)" : "";
    const scoped = (query) => {
      if (esLocal) return query.eq("congregacion_id", congregacionId);
      if (esDistrital) return query.eq("congregaciones.distrito_id", rolPrincipal.distrito_id);
      return query;
    };
    // Mapa de presencia: solo aplica a distrital/nacional (local ya ve su
    // propia congregación en todas partes). `congregaciones` trae
    // distrito_id directo, a diferencia de las tablas de arriba -- no
    // hace falta el truco de embed para acotarla por distrito.
    let congregacionesQuery = supabase.from("congregaciones").select("id, nombre, ciudad, latitud, longitud, created_at, distrito_id, distritos(numero)");
    if (esDistrital) congregacionesQuery = congregacionesQuery.eq("distrito_id", rolPrincipal.distrito_id);
    const congregacionesPromise = esLocal ? Promise.resolve({ data: [] }) : congregacionesQuery;

    const [internosResult, cultosResult, estudiantesResult, institucionesResult, casosResult, ayudasResult, congregacionesResult] = await Promise.all([
      scoped(supabase.from("obra_carcelaria_internos").select(`estado, bautizado, sellado${distritoEmbed}`)),
      scoped(supabase.from("obra_carcelaria_cultos").select(`asistentes_total${distritoEmbed}`).gte("fecha", desde12m)),
      scoped(supabase.from("mision_estudiantes").select(`estado${distritoEmbed}`)),
      scoped(supabase.from("mision_instituciones").select(`id${distritoEmbed}`, { count: "exact", head: true }).eq("activo", true)),
      scoped(supabase.from("obra_social_casos").select(`estado${distritoEmbed}`)),
      esLocal
        ? supabase.from("obra_social_ayudas").select("id, obra_social_casos!inner(congregacion_id)", { count: "exact", head: true }).eq("obra_social_casos.congregacion_id", congregacionId).gte("fecha", desde12m)
        : esDistrital
          ? supabase.from("obra_social_ayudas").select("id, obra_social_casos!inner(congregaciones!inner(distrito_id))", { count: "exact", head: true }).eq("obra_social_casos.congregaciones.distrito_id", rolPrincipal.distrito_id).gte("fecha", desde12m)
          : supabase.from("obra_social_ayudas").select("id", { count: "exact", head: true }).gte("fecha", desde12m),
      congregacionesPromise,
    ]);
    // vw_resumen_feligresia: consulta aparte (no embebida) por los ids ya
    // resueltos arriba -- PostgREST no siempre puede inferir un embed a
    // traves de una vista, asi que dos pasos simples es lo mas seguro.
    const congregacionesList = congregacionesResult.data ?? [];
    const congregacionIds = congregacionesList.map((item) => item.id);
    const resumenResult = congregacionIds.length
      ? await supabase.from("vw_resumen_feligresia").select("congregacion_id, personas_activas").in("congregacion_id", congregacionIds)
      : { data: [] };
    const failed = [internosResult, cultosResult, estudiantesResult, institucionesResult, casosResult, ayudasResult, congregacionesResult, resumenResult].find((item) => item.error);
    if (failed) setError("No se pudo cargar el impacto misionero. Intenta nuevamente.");
    const personasPorCongregacion = new Map((resumenResult.data ?? []).map((item) => [item.congregacion_id, item.personas_activas || 0]));
    const newData = {
      internos: internosResult.data ?? [],
      cultos: cultosResult.data ?? [],
      estudiantes: estudiantesResult.data ?? [],
      institucionesCount: institucionesResult.count ?? 0,
      casos: casosResult.data ?? [],
      ayudasCount: ayudasResult.count ?? 0,
      congregaciones: congregacionesList.map((item) => ({ ...item, personasActivas: personasPorCongregacion.get(item.id) || 0 })),
    };
    setData(newData);
    setLoading(false);
    impactoMisioneroCache.set(cacheKey, newData);
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando impacto misionero...</div>;
  if (error && !data) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>;

  const internosActivos = data.internos.filter((item) => item.estado === "activo").length;
  const internosBautizados = data.internos.filter((item) => item.bautizado).length;
  const asistenciaCultos12m = data.cultos.reduce((total, item) => total + Number(item.asistentes_total || 0), 0);
  const estudiantesActivos = data.estudiantes.filter((item) => item.estado !== "inactivo").length;
  const estudiantesBautizados = data.estudiantes.filter((item) => item.estado === "bautizado").length;
  const casosResueltos = data.casos.filter((item) => item.estado === "resuelta" || item.estado === "cerrada").length;
  const casosActivos = data.casos.filter((item) => item.estado === "identificada" || item.estado === "en_apoyo").length;
  const personasAlcanzadas = internosActivos + estudiantesActivos + casosActivos;
  const distribucion = distributionDataset(
    [
      { label: "Obra Carcelaria", total: internosActivos },
      { label: "Misión Juvenil", total: estudiantesActivos },
      { label: "Obra Social", total: casosActivos },
    ],
    { datasetLabel: "Personas alcanzadas" },
  );
  const alcance = esLocal ? "tu congregación" : nivel === "distrital" ? "tu distrito" : "la IPUC en Colombia";

  // Mapa de presencia -- mismo calculo de "agrupar por ciudad" que ya usa
  // GestionDistritos.jsx, para no inventar uno distinto.
  const desde12mMapa = fechaBogota(new Date(Date.now() - 365 * 86400000));
  const congregacionesActivas = data.congregaciones.length;
  const ciudadesMapa = (() => {
    const mapa = new Map();
    for (const congregacion of data.congregaciones) {
      const ciudad = congregacion.ciudad?.trim();
      if (!ciudad) continue;
      const clave = ciudad.toLowerCase();
      if (!mapa.has(clave)) mapa.set(clave, { ciudad, total: 0 });
      mapa.get(clave).total += 1;
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  })();
  const congregacionesNuevas12m = data.congregaciones.filter((item) => item.created_at >= desde12mMapa).length;
  const personasAlcanzadasMapa = data.congregaciones.reduce((total, item) => total + (item.personasActivas || 0), 0);
  const puntosMapa = data.congregaciones
    .filter((item) => Number.isFinite(item.latitud) && Number.isFinite(item.longitud))
    .map((item) => ({
      id: item.id,
      label: item.nombre,
      valor: item.personasActivas || 1,
      latitud: item.latitud,
      longitud: item.longitud,
      detalle: [item.ciudad, item.personasActivas ? `${item.personasActivas} activos` : null].filter(Boolean).join(" · "),
    }));
  const barrasCiudades = distributionDataset(
    ciudadesMapa.slice(0, 5).map((item) => ({ label: item.ciudad, total: item.total })),
    { datasetLabel: "Congregaciones" },
  );
  const tendenciaCrecimiento = (() => {
    const hoy = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({ limite: new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1), label: fecha.toLocaleDateString("es-CO", { month: "short" }) });
    }
    const conteos = meses.map(({ limite }) => data.congregaciones.filter((item) => item.created_at && new Date(item.created_at) < limite).length);
    return trendDataset(meses.map((m) => m.label), conteos, { label: "Congregaciones" });
  })();

  // Territorio alcanzado por distrito: solo nacional/super_admin ve
  // varios distritos a la vez (distrital ya filtra a uno solo, una
  // mancha de un solo color no aporta nada ahi). `distritos` viene
  // embebido del select de congregaciones.
  const congregacionesConDistrito = data.congregaciones.map((item) => ({
    id: item.id,
    latitud: item.latitud,
    longitud: item.longitud,
    distrito_id: item.distrito_id,
    distrito_numero: item.distritos?.numero ?? null,
  }));

  function exportResumen() {
    return {
      kpis: [
        { label: "Personas alcanzadas", value: personasAlcanzadas },
        { label: "Internos en Obra Carcelaria", value: internosActivos },
        { label: "Estudiantes en Misión Juvenil", value: estudiantesActivos },
        { label: "Casos de Obra Social", value: casosActivos },
      ],
    };
  }
  function exportHeaders() {
    return {
      headers: ["Frente", "Personas/casos activos", "Detalle"],
      rows: [
        ["Obra Carcelaria", internosActivos, `${internosBautizados} bautizados`],
        ["Misión Juvenil", estudiantesActivos, `${estudiantesBautizados} bautizados · ${data.institucionesCount} instituciones`],
        ["Obra Social", casosActivos, `${casosResueltos} resueltos`],
      ],
    };
  }
  function exportCsv() { descargarCsv({ filename: `impacto-misionero-${hoyBogota()}.csv`, titulo: `Impacto Misionero — ${alcance}`, ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `impacto-misionero-${hoyBogota()}.xlsx`, hoja: "Impacto", titulo: `Impacto Misionero — ${alcance}`, resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `impacto-misionero-${hoyBogota()}.pdf`, titulo: `Impacto Misionero — ${alcance}`, resumen: exportResumen(), ...exportHeaders() }); }

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Frentes misioneros</p>
          <h1 className="section-title">Impacto Misionero</h1>
          <p className="text-sm text-secondary mt-1">Alcance combinado de Obra Carcelaria, Misión Juvenil y Obra Social en {alcance}.</p>
        </div>
        <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Personas alcanzadas" value={personasAlcanzadas} detail="Activas en los 3 frentes" tip="Suma de personas activas ahora mismo en Obra Carcelaria, Misión Juvenil y Obra Social. Es un conteo simple de los 3 frentes, no personas distintas verificadas una por una." />
        <Metric label="Internos en Obra Carcelaria" value={internosActivos} detail={`${internosBautizados} bautizados`} />
        <Metric label="Estudiantes en Misión Juvenil" value={estudiantesActivos} detail={`${estudiantesBautizados} bautizados · ${data.institucionesCount} instituciones`} />
        <Metric label="Casos de Obra Social" value={casosActivos} detail={`${casosResueltos} resueltos`} />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Distribución</p>
          <h2 className="font-medium mt-1">Personas alcanzadas por frente</h2>
          <div className="h-64 mt-4">
            {personasAlcanzadas ? <Bar data={distribucion} options={CHART_OPTIONS} /> : <ChartEmpty message="Aún no hay personas activas en estos frentes." />}
          </div>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Últimos 12 meses</p>
          <h2 className="font-medium mt-1">Actividad reciente</h2>
          <div className="flex flex-col gap-3 mt-5">
            <div className="flex justify-between items-center gap-3">
              <p className="text-sm text-secondary flex items-center gap-1.5">Asistencia en cultos carcelarios<InfoTip texto="Suma de asistentes de todos los cultos de los últimos 12 meses. Si una misma persona fue a varios cultos, se cuenta cada vez, no una sola vez." /></p>
              <p className="text-lg font-semibold">{asistenciaCultos12m}</p>
            </div>
            <div className="flex justify-between items-center gap-3">
              <p className="text-sm text-secondary flex items-center gap-1.5">Ayudas de Obra Social entregadas<InfoTip texto="Número de ayudas puntuales entregadas en los últimos 12 meses (por ejemplo, un mercado o un pago de servicios), no el número de familias o casos atendidos." /></p>
              <p className="text-lg font-semibold">{data.ayudasCount}</p>
            </div>
          </div>
        </div>
      </section>

      {!esLocal && (
        <>
          <div>
            <p className="eyebrow">Geografía</p>
            <h2 className="section-title" style={{ fontSize: "1.15rem" }}>Mapa de presencia</h2>
            <p className="text-sm text-secondary mt-1">Dónde está ubicada cada congregación de {alcance === "tu distrito" ? "tu distrito" : "la IPUC"}, y cómo ha crecido en el tiempo.</p>
          </div>

          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="Congregaciones activas" value={congregacionesActivas} />
            <Metric label="Ciudades con presencia" value={ciudadesMapa.length} tip="Ciudades distintas con al menos una congregación, según el campo 'Ciudad' de cada congregación." />
            <Metric label="Nuevas · últimos 12 meses" value={congregacionesNuevas12m} />
            <Metric label="Personas alcanzadas" value={personasAlcanzadasMapa} tip="Suma de feligreses activos de todas las congregaciones en el mapa. No incluye amigos en ruta ni los frentes de Obra Carcelaria/Misión Juvenil/Obra Social." />
          </section>

          <section className="relative rounded-card overflow-hidden" style={{ boxShadow: "0 24px 60px -20px rgba(10,20,40,0.45)" }}>
            <GeoMap points={puntosMapa} height={460} premium colorHex="#5B9BE0" />
            {puntosMapa.length > 0 && (
              <>
                {/* z-index 1200 + transform:translateZ(0) es intencional, no
                    decorativo: Leaflet usa z-index internos hasta 1000+ para
                    sus propios controles/paneles, y en cuanto un elemento
                    externo recibe su propia capa compuesta (transform),
                    empieza a compararse numericamente contra esos paneles en
                    vez de heredar el orden normal del DOM -- con menos de
                    ~1000 esta tarjeta queda invisible por debajo del mapa,
                    sin ningun error en consola. Verificado visualmente antes
                    de este fix: con z-index 10 no se veia nada. */}
                {/* Vidrio oscuro a propósito, aunque el mapa ahora es claro
                    (navigation-day-v1): un chip oscuro flotante se lee bien
                    encima de cualquier mosaico, y es el mismo lenguaje visual
                    que ya usan los controles/tooltips de Leaflet en modo
                    premium (ver PREMIUM_STYLE en GeoMap.jsx). Un chip claro
                    aquí se fundiría con el fondo del mapa. */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none" style={{ zIndex: 1200, transform: "translateZ(0)" }}>
                  <div className="rounded-xl px-4 py-2.5" style={{ background: "rgba(10,18,36,0.82)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.4)" }}>
                    <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "rgba(234,241,250,0.65)" }}>Congregaciones</p>
                    <p className="text-xl font-semibold text-white mt-0.5">{congregacionesActivas}</p>
                  </div>
                  <div className="rounded-xl px-4 py-2.5" style={{ background: "rgba(10,18,36,0.82)", backdropFilter: "blur(16px)", border: "1px solid rgba(62,224,200,0.35)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.4)" }}>
                    <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "#8FEFDF" }}>Ciudades</p>
                    <p className="text-xl font-semibold mt-0.5" style={{ color: "#3EE0C8" }}>{ciudadesMapa.length}</p>
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 rounded-xl px-3.5 py-2.5 pointer-events-none" style={{ zIndex: 1200, transform: "translateZ(0)", background: "rgba(10,18,36,0.82)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.4)" }}>
                  <p className="text-xs font-medium text-white">Congregaciones ubicadas</p>
                  <p className="text-[11px]" style={{ color: "rgba(234,241,250,0.75)" }}>El tamaño de cada punto refleja feligreses activos</p>
                </div>
              </>
            )}
          </section>

          <section className="grid lg:grid-cols-2 gap-4">
            <div className="card chart-card p-5">
              <p className="eyebrow">Cobertura</p>
              <h2 className="font-medium mt-1">Congregaciones por ciudad</h2>
              <div className="h-56 mt-4">
                {ciudadesMapa.length ? <Bar data={barrasCiudades} options={CHART_OPTIONS} /> : <ChartEmpty message="Aún no hay congregaciones con ciudad registrada." />}
              </div>
            </div>
            <div className="card chart-card p-5">
              <p className="eyebrow">Tendencia</p>
              <h2 className="font-medium mt-1">Crecimiento de congregaciones · 6 meses</h2>
              <div className="h-56 mt-4">
                {congregacionesActivas ? <Line data={tendenciaCrecimiento} options={CHART_OPTIONS} /> : <ChartEmpty message="Aún no hay congregaciones para mostrar la tendencia." />}
              </div>
            </div>
          </section>

          {esNacionalOSuperAdmin && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <p className="eyebrow">Territorio</p>
                  <h2 className="section-title" style={{ fontSize: "1.15rem" }}>Territorio alcanzado por distrito</h2>
                  <p className="text-sm text-secondary mt-1 max-w-2xl">Aproximación por radio de alcance alrededor de cada congregación, agrupada por distrito -- no es un límite territorial oficial. Las zonas sin color no tienen ninguna congregación de la IPUC cerca; es información real para decidir dónde enviar misión.</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {[10, 15, 20].map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setRadioKm(valor)}
                      className={radioKm === valor ? "btn-primary text-xs px-3 py-1.5" : "btn-secondary text-xs px-3 py-1.5"}
                    >
                      {valor} km
                    </button>
                  ))}
                </div>
              </div>
              <section className="rounded-card overflow-hidden" style={{ boxShadow: "0 24px 60px -20px rgba(10,20,40,0.45)" }}>
                <MapaTerritorios congregaciones={congregacionesConDistrito} radioKm={radioKm} height={480} />
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
