import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";

const ALLOWED_LEVELS = ["nacional", "super_admin"];

function Metric({ label, value, detail }) {
  return (
    <div className="stat-tile">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{label}</p>
      <p className="text-2xl font-semibold mt-3">{value}</p>
      {detail && <p className="text-xs text-muted mt-1">{detail}</p>}
    </div>
  );
}

function formatDistritoLabel(nombre, numero) {
  return numero ? `Distrito ${numero} · ${nombre}` : nombre;
}

export default function GestionPastoralNacional() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const [distritos, setDistritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!rolPrincipal || !ALLOWED_LEVELS.includes(rolPrincipal.nivel)) return;
    supabase.rpc("resumen_pastoral_nacional").then(({ data, error: rpcError }) => {
      if (rpcError) setError("No se pudo cargar la gestión pastoral nacional.");
      setDistritos(data ?? []);
      setLoading(false);
    });
  }, [rolPrincipal]);

  if (roleLoading) return <div className="module-loading" role="status"><span className="loading-dot" />Validando permisos...</div>;
  if (!ALLOWED_LEVELS.includes(rolPrincipal?.nivel)) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Esta vista es exclusiva de nacional/super_admin.</p>;
  if (loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando gestión pastoral nacional...</div>;

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
        <p className="eyebrow">Administración nacional</p>
        <h1 className="section-title">Gestión Pastoral Nacional</h1>
        <p className="text-sm text-secondary mt-0.5">Escalafón ministerial y directiva distrital (Supervisor, Secretario, Tesorero, Presbíteros, Veedor) de los 36 distritos.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Pastores en todo el país" value={totalPastores} detail={`${totalOrdenacion} ordenados`} />
        <Metric label="Congregaciones vacantes" value={totalVacantes} />
        <Metric label="Cargos distritales vacantes" value={totalCargosVacantes} detail="Sobre 6 cargos por distrito" />
        <Metric label="Distritos" value={distritos.length} />
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">Escalafón ministerial por distrito</h2>
          <p className="text-sm text-secondary mt-1">Obrero → Licencia Local → Licencia General → Ordenación Ministerial.</p>
        </div>
        {distritos.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay distritos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-5 py-3">Distrito</th>
                  <th className="font-normal px-5 py-3">Obrero</th>
                  <th className="font-normal px-5 py-3">Licencia local</th>
                  <th className="font-normal px-5 py-3">Licencia general</th>
                  <th className="font-normal px-5 py-3">Ordenación</th>
                  <th className="font-normal px-5 py-3">Congregaciones vacantes</th>
                  <th className="font-normal px-5 py-3">Cargos distritales ocupados</th>
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
                    <td className={`px-5 py-3 ${Number(item.cargos_vacantes) > 0 ? "text-warning" : "text-secondary"}`}>{item.cargos_ocupados} de 6</td>
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
