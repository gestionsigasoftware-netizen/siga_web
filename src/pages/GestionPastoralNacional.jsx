import { useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";
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

function OtorgarAccesoJerarquico({ esSuperAdmin, distritos }) {
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
      setMessage({ type: "error", text: "Selecciona una persona, un correo y (si aplica) un distrito." });
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
      setMessage({ type: "error", text: serverMessage || "No se pudo otorgar el acceso. Intenta nuevamente." });
      return;
    }
    if (!data?.ok) { setMessage({ type: "error", text: "No se pudo confirmar el acceso." }); return; }
    setSelectedPerson(null);
    setSearchTerm("");
    setEmail("");
    setDistritoId("");
    setMessage({
      type: "success",
      text: data.yaTeniaAcceso
        ? "La persona ya tenía este acceso activo."
        : data.invitationSent
          ? "Acceso otorgado. La persona recibirá un enlace para crear su contraseña."
          : "Acceso otorgado. La persona puede ingresar con sus credenciales actuales.",
    });
  }

  return (
    <section className="card p-5">
      <div className="flex items-center gap-3 mb-1"><UserPlus className="w-5 h-5 text-accent" /><h2 className="font-medium">Otorgar acceso al sistema</h2></div>
      <p className="text-sm text-secondary mb-4">Da de alta el acceso de un nuevo líder distrital{esSuperAdmin ? " o nacional" : ""} — sin depender de Supabase directamente.</p>
      <form onSubmit={otorgar} className="grid sm:grid-cols-2 gap-3">
        <div className="relative sm:col-span-2">
          <label className="text-sm">Persona (buscar en el censo nacional)
            <div className="relative mt-1.5">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setSelectedPerson(null); }} placeholder="Escribe un nombre..." className="input-field pl-9" />
            </div>
          </label>
          {searchTerm.trim().length >= 2 && !selectedPerson && (
            <div className="absolute z-10 w-full mt-1 bg-surface-2 border border-border rounded-card shadow-lg max-h-56 overflow-y-auto">
              {searching ? <p className="p-3 text-xs text-muted">Buscando...</p> : results.length === 0 ? <p className="p-3 text-xs text-muted">Sin resultados.</p> : results.map((person) => (
                <button type="button" key={person.id} onClick={() => selectPerson(person)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-1">
                  {person.nombres} {person.apellidos} <span className="text-xs text-muted">· {person.congregaciones?.nombre || "Sin congregación"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="text-sm">Nivel a otorgar<select className="input-field mt-1.5" value={nivel} onChange={(event) => setNivel(event.target.value)}><option value="distrital">Distrital</option>{esSuperAdmin && <option value="nacional">Nacional</option>}</select></label>
        {nivel === "distrital" && <label className="text-sm">Distrito<select required className="input-field mt-1.5" value={distritoId} onChange={(event) => setDistritoId(event.target.value)}><option value="">Seleccionar...</option>{distritos.map((distrito) => <option key={distrito.distrito_id} value={distrito.distrito_id}>{formatDistritoLabel(distrito.nombre, distrito.numero)}</option>)}</select></label>}
        <label className="text-sm sm:col-span-2">Correo de acceso<input required type="email" className="input-field mt-1.5" placeholder="persona@correo.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button disabled={saving || !selectedPerson} className="btn-primary justify-center sm:w-fit sm:col-span-2">{saving ? "Otorgando..." : "Otorgar acceso"}</button>
      </form>
      {message && <p role={message.type === "error" ? "alert" : "status"} className={`text-sm mt-3 ${message.type === "error" ? "text-danger" : "text-success"}`}>{message.text}</p>}
    </section>
  );
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

      <OtorgarAccesoJerarquico esSuperAdmin={rolPrincipal?.nivel === "super_admin"} distritos={distritos} />

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
