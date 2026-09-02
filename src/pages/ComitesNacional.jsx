import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";

const ALLOWED_LEVELS = ["nacional", "super_admin"];

function formatDistritoLabel(nombre, numero) {
  return numero ? `Distrito ${numero} · ${nombre}` : nombre;
}

export default function ComitesNacional() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const [distritos, setDistritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!rolPrincipal || !ALLOWED_LEVELS.includes(rolPrincipal.nivel)) return;
    supabase.rpc("resumen_comites_nacional").then(({ data, error: rpcError }) => {
      if (rpcError) setError("No se pudo cargar el consolidado nacional de comités.");
      setDistritos(data ?? []);
      setLoading(false);
    });
  }, [rolPrincipal]);

  if (roleLoading) return <div className="module-loading" role="status"><span className="loading-dot" />Validando permisos...</div>;
  if (!ALLOWED_LEVELS.includes(rolPrincipal?.nivel)) return <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">Esta vista es exclusiva de nacional/super_admin.</p>;
  if (loading) return <div className="module-loading" role="status"><span className="loading-dot" />Cargando consolidado de comités...</div>;

  const sumar = (campo) => distritos.reduce((total, item) => total + Number(item[campo] || 0), 0);
  const columnas = [
    ["escuela_dominical_ninos", "Escuela Dominical"],
    ["damas_dorcas_beneficiarias", "Damas Dorcas"],
    ["obra_carcelaria_internos", "Obra Carcelaria"],
    ["musica_integrantes", "Música"],
    ["artistica_integrantes", "Ed. Artística"],
    ["teologica_integrantes", "Ed. Teológica"],
    ["conquistadores_miembros", "Conquistadores"],
    ["obra_social_casos", "Obra Social"],
    ["mision_juvenil_estudiantes", "Misión Juvenil"],
    ["red_familias_casos", "Red de Familias"],
  ];

  return (
    <div className="page-shell">
      <header>
        <p className="eyebrow">Administración nacional</p>
        <h1 className="section-title">Comités Nacional</h1>
        <p className="text-sm text-secondary mt-0.5">Los 10 comités reales de la IPUC, consolidados por distrito — misma información que ya ve cada distrital sobre su propio distrito, ahora a escala país.</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {columnas.map(([campo, label]) => (
          <div key={campo} className="stat-tile">
            <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{label}</p>
            <p className="text-2xl font-semibold mt-3">{sumar(campo)}</p>
          </div>
        ))}
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-medium">Por distrito</h2>
          <p className="text-sm text-secondary mt-1">Número principal de cada comité — el detalle operativo completo lo maneja cada distrital en Pastoral Distrital.</p>
        </div>
        {distritos.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aún no hay distritos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-surface-1">
                  <th className="font-normal px-4 py-2.5 whitespace-nowrap">Distrito</th>
                  {columnas.map(([campo, label]) => <th key={campo} className="font-normal px-4 py-2.5 whitespace-nowrap">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {distritos.map((item) => (
                  <tr key={item.distrito_id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">{formatDistritoLabel(item.nombre, item.numero)}</td>
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
