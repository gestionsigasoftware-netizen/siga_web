import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, distributionDataset } from "../lib/chartTheme";
import ChartEmpty from "../components/ChartEmpty";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const CHART_OPTIONS = chartOptions();

function Metric({ label, value, detail }) {
  return (
    <div className="stat-tile">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{label}</p>
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    setLoading(true);
    setError(null);
    const desde12m = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const scoped = (query) => (esLocal ? query.eq("congregacion_id", congregacionId) : query);
    const [internosResult, cultosResult, estudiantesResult, institucionesResult, casosResult, ayudasResult] = await Promise.all([
      scoped(supabase.from("obra_carcelaria_internos").select("estado, bautizado, sellado")),
      scoped(supabase.from("obra_carcelaria_cultos").select("asistentes_total").gte("fecha", desde12m)),
      scoped(supabase.from("mision_estudiantes").select("estado")),
      scoped(supabase.from("mision_instituciones").select("id", { count: "exact", head: true }).eq("activo", true)),
      scoped(supabase.from("obra_social_casos").select("estado")),
      esLocal
        ? supabase.from("obra_social_ayudas").select("id, obra_social_casos!inner(congregacion_id)", { count: "exact", head: true }).eq("obra_social_casos.congregacion_id", congregacionId).gte("fecha", desde12m)
        : supabase.from("obra_social_ayudas").select("id", { count: "exact", head: true }).gte("fecha", desde12m),
    ]);
    const failed = [internosResult, cultosResult, estudiantesResult, institucionesResult, casosResult, ayudasResult].find((item) => item.error);
    if (failed) setError("No se pudo cargar el impacto misionero. Intenta nuevamente.");
    setData({
      internos: internosResult.data ?? [],
      cultos: cultosResult.data ?? [],
      estudiantes: estudiantesResult.data ?? [],
      institucionesCount: institucionesResult.count ?? 0,
      casos: casosResult.data ?? [],
      ayudasCount: ayudasResult.count ?? 0,
    });
    setLoading(false);
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

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Frentes misioneros</p>
        <h1 className="section-title">Impacto Misionero</h1>
        <p className="text-sm text-secondary mt-1">Alcance combinado de Obra Carcelaria, Misión Juvenil y Obra Social en {alcance}.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Personas alcanzadas" value={personasAlcanzadas} detail="Activas en los 3 frentes" />
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
              <p className="text-sm text-secondary">Asistencia en cultos carcelarios</p>
              <p className="text-lg font-semibold">{asistenciaCultos12m}</p>
            </div>
            <div className="flex justify-between items-center gap-3">
              <p className="text-sm text-secondary">Ayudas de Obra Social entregadas</p>
              <p className="text-lg font-semibold">{data.ayudasCount}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
