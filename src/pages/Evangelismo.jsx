import { useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { ArrowLeft, ArrowRight, MapPinned, Plus, Target, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";

ChartJS.register(
  BarElement,
  CategoryScale,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);
const PERIODOS = [
  ["30", "30 días"],
  ["180", "6 meses"],
  ["365", "12 meses"],
];
const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: "#111820", padding: 10 },
  },
  scales: {
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: "rgba(82,81,78,0.1)" },
      ticks: { color: "#898781", precision: 0 },
    },
    x: {
      border: { display: false },
      grid: { display: false },
      ticks: { color: "#898781", maxRotation: 0 },
    },
  },
};

function Metric({ label, value, detail, tone = "" }) {
  return (
    <div className="stat-tile">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">
        {label}
      </p>
      <p className={`text-2xl font-semibold mt-3 ${tone}`}>{value}</p>
      {detail && <p className="text-xs text-muted mt-1">{detail}</p>}
    </div>
  );
}

export default function Evangelismo() {
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [modulo, setModulo] = useState(null);
  const [zonas, setZonas] = useState([]);
  const [metodos, setMetodos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [amigos, setAmigos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [periodo, setPeriodo] = useState("180");
  const [zonaFiltro, setZonaFiltro] = useState("todos");
  const [metodoFiltro, setMetodoFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [zoneEditName, setZoneEditName] = useState("");
  const [zoneEditLeader, setZoneEditLeader] = useState("");
  const [zonaForm, setZonaForm] = useState({
    nombre: "",
    tipo: "barrio",
    responsable_id: "",
  });
  const [metodoForm, setMetodoForm] = useState("");

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError("Tu usuario no tiene una congregación local asignada.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const start = new Date();
      start.setDate(start.getDate() - Number(periodo));
      const startKey = start.toISOString().slice(0, 10);
      const [
        moduleResult,
        zonesResult,
        recordsResult,
        friendsResult,
        peopleResult,
      ] = await Promise.all([
        supabase
          .from("modulos")
          .select(
            "id, nombre_modulo, alcance, requiere_zona, tipos_actividad(id, nombre, caracter, activo)",
          )
          .eq("congregacion_id", congregacionId)
          .ilike("nombre_modulo", "Evangelismo")
          .order("id")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("zonas")
          .select(
            "id, nombre, modulo_id, lider_persona_id, personas:lider_persona_id(nombres, apellidos)",
          )
          .eq("congregacion_id", congregacionId)
          .order("nombre"),
        supabase
          .from("registros_actividad")
          .select(
            "id, modulo_id, fecha, zona_id, tipo_actividad_id, total_asistentes, desglose, responsable_persona_id, tipos_actividad(nombre), personas:responsable_persona_id(nombres, apellidos), zonas(nombre)",
          )
          .eq("congregacion_id", congregacionId)
          .gte("fecha", startKey)
          .order("fecha"),
        supabase
          .from("amigos")
          .select("id, convertido, zona_id, evangelismo_metodologia_id")
          .eq("congregacion_id", congregacionId),
        supabase
          .from("personas")
          .select("id, nombres, apellidos")
          .eq("congregacion_id", congregacionId)
          .eq("estado_membresia", "activo")
          .order("nombres"),
      ]);
      if (
        moduleResult.error ||
        zonesResult.error ||
        recordsResult.error ||
        friendsResult.error ||
        peopleResult.error
      )
        setError(
          "No se pudo cargar Evangelismo. Intenta nuevamente o contacta al administrador.",
        );
      const loadedModule = moduleResult.data;
      setModulo(loadedModule);
      setZonas(
        (zonesResult.data ?? []).filter(
          (zone) => !loadedModule?.id || zone.modulo_id === loadedModule.id,
        ),
      );
      setMetodos(
        (loadedModule?.tipos_actividad ?? []).filter(
          (method) => method.activo !== false,
        ),
      );
      setRegistros(
        (recordsResult.data ?? []).filter(
          (record) => !loadedModule?.id || record.modulo_id === loadedModule.id,
        ),
      );
      setAmigos(friendsResult.data ?? []);
      setPersonas(peopleResult.data ?? []);
    } catch (loadError) {
      setError(`No se pudo cargar Evangelismo: ${loadError.message}`);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "evangelismo.editar" }).then(({ data }) => setCanEdit(Boolean(data)));
  }, [congregacionId]);

  const visibles = registros.filter(
    (registro) =>
      (zonaFiltro === "todos" || registro.zona_id === zonaFiltro) &&
      (metodoFiltro === "todos" || registro.tipo_actividad_id === metodoFiltro),
  );
  const totalAsistencia = visibles.reduce(
    (sum, item) => sum + Number(item.total_asistentes || 0),
    0,
  );
  const promedio = visibles.length
    ? Math.round(totalAsistencia / visibles.length)
    : 0;
  const totalConversiones = amigos.filter(
    (friend) =>
      friend.convertido &&
      (zonaFiltro === "todos" || friend.zona_id === zonaFiltro) &&
      (metodoFiltro === "todos" ||
        friend.evangelismo_metodologia_id === metodoFiltro),
  ).length;
  const conversionRate = totalAsistencia ? Math.round((totalConversiones / totalAsistencia) * 100) : 0;
  const amigosSinZona = amigos.filter((friend) => !friend.zona_id).length;
  const amigosEnRuta = amigos.filter(
    (friend) =>
      !friend.convertido &&
      (zonaFiltro === "todos" || friend.zona_id === zonaFiltro),
  ).length;
  const zonaRows = zonas
    .map((zone) => {
      const rows = visibles.filter((item) => item.zona_id === zone.id);
      return {
        ...zone,
        registros: rows.length,
        asistencia: rows.reduce(
          (sum, item) => sum + Number(item.total_asistentes || 0),
          0,
        ),
        conversiones: amigos.filter(
          (friend) => friend.convertido && friend.zona_id === zone.id,
        ).length,
        amigos: amigos.filter((friend) => friend.zona_id === zone.id).length,
      };
    })
    .sort((a, b) => b.conversiones - a.conversiones);
  const metodoRows = metodos
    .map((method) => {
      const rows = visibles.filter(
        (item) => item.tipo_actividad_id === method.id,
      );
      return {
        ...method,
        registros: rows.length,
        asistencia: rows.reduce(
          (sum, item) => sum + Number(item.total_asistentes || 0),
          0,
        ),
        conversiones: amigos.filter(
          (friend) =>
            friend.convertido &&
            friend.evangelismo_metodologia_id === method.id,
        ).length,
      };
    })
    .filter((row) => row.registros);
  const tendencia = [...new Set(visibles.map((item) => item.fecha))]
    .sort()
    .map((fecha) => ({
      fecha,
      total: visibles
        .filter((item) => item.fecha === fecha)
        .reduce((sum, item) => sum + Number(item.total_asistentes || 0), 0),
    }));
  const liderZona = zonaRows[0];
  const liderMetodo = [...metodoRows].sort(
    (a, b) => b.conversiones - a.conversiones,
  )[0];
  const insight = liderZona?.conversiones
    ? `${liderZona.nombre} lidera con ${liderZona.conversiones} conversiones. Revisa qué metodología y responsable están activos allí para replicar esa estrategia.`
    : amigosEnRuta
      ? `Hay ${amigosEnRuta} personas en ruta sin conversión registrada en este filtro. Prioriza su seguimiento y verifica la continuidad de las visitas.`
      : "La asistencia está disponible, pero aún faltan amigos vinculados a zonas y metodologías para medir receptividad y conversión.";
  const alerts = [
    ...zonaRows.filter((row) => row.registros === 0).map((row) => ({ title: `${row.nombre} sin actividad`, detail: "No tiene capturas móviles en el periodo seleccionado.", tone: "danger" })),
    ...zonaRows.filter((row) => row.registros > 0 && row.asistencia / row.registros < 5).map((row) => ({ title: `${row.nombre} con baja asistencia`, detail: `Promedio de ${Math.round(row.asistencia / row.registros)} asistentes por captura.`, tone: "warning" })),
    ...(totalAsistencia > 0 && conversionRate < 5 ? [{ title: "Conversión baja", detail: `La conversión sobre asistentes es ${conversionRate}%. Revisa el seguimiento individual.`, tone: "warning" }] : []),
    ...(amigosSinZona ? [{ title: "Amigos sin territorio", detail: `${amigosSinZona} personas no tienen barrio o vereda asignado.`, tone: "danger" }] : []),
  ];

  async function createZone(event) {
    event.preventDefault();
    if (!canEdit || !zonaForm.nombre.trim() || !modulo?.id) return;
    const result = await supabase
      .from("zonas")
      .insert({
        congregacion_id: congregacionId,
        modulo_id: modulo.id,
        nombre: `${zonaForm.tipo}: ${zonaForm.nombre.trim()}`,
        lider_persona_id: zonaForm.responsable_id || null,
      });
    if (result.error)
      setError(`No se pudo crear la cobertura: ${result.error.message}`);
    else {
      setNotice("Lugar de cobertura creado.");
      setZonaForm({ nombre: "", tipo: "barrio", responsable_id: "" });
      load();
    }
  }
  async function createMethod(event) {
    event.preventDefault();
    if (!canEdit || !metodoForm.trim() || !modulo?.id) return;
    const result = await supabase
      .from("tipos_actividad")
      .insert({
        modulo_id: modulo.id,
        nombre: metodoForm.trim(),
        caracter: "Evangelismo",
      });
    if (result.error)
      setError(`No se pudo crear la metodología: ${result.error.message}`);
    else {
      setNotice(
        "Metodología creada correctamente.",
      );
      setMetodoForm("");
      load();
    }
  }
  async function updateZone(event) {
    event.preventDefault();
    if (!canEdit) return;
    const result = await supabase.from("zonas").update({ nombre: zoneEditName.trim(), lider_persona_id: zoneEditLeader || null }).eq("id", editingZoneId).eq("congregacion_id", congregacionId);
    if (result.error) setError(`No se pudo actualizar el líder: ${result.error.message}`);
    else { setNotice("Responsable de zona actualizado."); setEditingZoneId(null); load(); }
  }

  if (roleLoading || loading)
    return (
      <div className="module-loading" role="status">
        <span className="loading-dot" />
        Cargando Evangelismo...
      </div>
    );
  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to="/misiones-evangelismo" className="btn-secondary mb-4">
            <ArrowLeft className="w-4 h-4" />
            Volver a Misiones y Evangelismo
          </Link>
          <p className="eyebrow">Misión territorial</p>
          <h1 className="section-title">Evangelismo</h1>
          <p className="text-sm text-secondary mt-1">
            Consulta la actividad evangelística, sus zonas, metodologías y responsables.
          </p>
        </div>
        <div
          className="flex gap-1.5"
          role="group"
          aria-label="Periodo del análisis"
        >
          {PERIODOS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriodo(value)}
              className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-ink text-white border-ink" : "border-border text-secondary"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="text-sm text-danger bg-danger-bg rounded p-3"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="text-sm text-success bg-success-bg rounded p-3"
        >
          {notice}
        </p>
      )}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label="Lugares en cobertura" value={zonas.length} />
        <Metric label="Capturas móviles" value={visibles.length} />
        <Metric label="Asistencia promedio" value={promedio} />
        <Metric label="Amigos en ruta" value={amigosEnRuta} />
        <Metric
          label="Conversiones"
          value={totalConversiones}
          tone="text-success"
        />
        <Metric label="Conversión / asistente" value={`${conversionRate}%`} detail="Indicador de referencia" />
      </section>
      <section className="card p-5">
        <div className="flex items-start gap-3 pb-4 border-b border-border">
          <span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0"><Target className="w-4 h-4" /></span>
          <div><p className="eyebrow">Análisis territorial</p><h2 className="font-medium mt-1">Filtros para decidir</h2><p className="text-xs text-secondary mt-1">Ajusta el lugar y la metodología sin cambiar los datos registrados.</p></div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <label className="text-xs text-secondary">Barrio, vereda o sector
            <select aria-label="Filtrar por barrio o vereda" className="input-field mt-1.5" value={zonaFiltro} onChange={(event) => setZonaFiltro(event.target.value)}>
              <option value="todos">Todos los barrios y veredas</option>
              {zonas.map((zone) => <option key={zone.id} value={zone.id}>{zone.nombre}</option>)}
            </select>
          </label>
          <label className="text-xs text-secondary">Metodología utilizada
            <select aria-label="Filtrar por metodología" className="input-field mt-1.5" value={metodoFiltro} onChange={(event) => setMetodoFiltro(event.target.value)}>
              <option value="todos">Todas las metodologías</option>
              {metodos.map((method) => <option key={method.id} value={method.id}>{method.nombre}</option>)}
            </select>
          </label>
        </div>
      </section>
      <p
        className={`text-sm rounded p-3 ${liderZona?.conversiones ? "text-success bg-success-bg" : "text-secondary bg-surface-1"}`}
      >
        {insight}
      </p>
      {alerts.length > 0 && (
        <section className="card p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Señales de gestión</p><h2 className="font-medium mt-1">Alertas para actuar</h2></div><span className="chart-highlight">{alerts.length}</span></div>
          <div className="grid md:grid-cols-2 gap-3 mt-4">{alerts.slice(0, 6).map((alert) => <div key={alert.title} className={`rounded p-3 ${alert.tone === "danger" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning"}`}><p className="text-sm font-medium">{alert.title}</p><p className="text-xs mt-1">{alert.detail}</p></div>)}</div>
        </section>
      )}
      <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">Actividad registrada</p>
          <h2 className="font-medium mt-1">Asistencia por captura</h2>
          <div className="h-56 mt-4">
            <Line
              data={{
                labels: tendencia.map((item) => item.fecha),
                datasets: [
                  {
                    label: "Asistentes",
                    data: tendencia.map((item) => item.total),
                    borderColor: "#2a78d6",
                    backgroundColor: "rgba(42,120,214,0.12)",
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    borderWidth: 2.5,
                  },
                ],
              }}
              options={CHART_OPTIONS}
            />
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Eficacia</p>
          <h2 className="font-medium mt-1">Conversiones por metodología</h2>
          <div className="h-56 mt-4">
            <Bar
              data={{
                labels: metodoRows.map((item) => item.nombre),
                datasets: [
                  {
                    label: "Conversiones",
                    data: metodoRows.map((item) => item.conversiones),
                    backgroundColor: "#e06b35",
                    borderRadius: 4,
                    barThickness: 20,
                  },
                ],
              }}
              options={CHART_OPTIONS}
            />
          </div>
          {liderMetodo && (
            <p className="summary-insight mt-3">
              {liderMetodo.nombre} lidera las conversiones registradas.
            </p>
          )}
        </div>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Cobertura territorial</p>
              <h2 className="font-medium mt-1">
                Rendimiento por barrio o vereda
              </h2>
            </div>
            <MapPinned className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-2">Lugar</th>
                  <th className="py-2 text-right">Capturas</th>
                  <th className="py-2 text-right">Asist.</th>
                  <th className="py-2 text-right">Conv.</th>
                  <th className="py-2 text-right">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {zonaRows.map((row) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="py-2">
                      <p className="font-medium">{row.nombre}</p>
                      <p className="text-xs text-muted">
                        {row.amigos} amigos en ruta
                      </p>
                    </td>
                    <td className="py-2 text-right">{row.registros}</td>
                    <td className="py-2 text-right">{row.asistencia}</td>
                    <td className="py-2 text-right font-medium text-success">
                      {row.conversiones}
                    </td>
                    <td className="py-2 text-right">{canEdit && <button type="button" className="text-xs text-accent" onClick={() => { setEditingZoneId(row.id); setZoneEditName(row.nombre); setZoneEditLeader(row.lider_persona_id || "") }}>Editar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Flujo individual</p>
              <h2 className="font-medium mt-1">Amigos y responsables</h2>
            </div>
            <UsersRound className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-secondary mt-4">
            La asistencia se analiza junto con la ruta individual. Para medir conversión
            individual, vincula cada amigo a su barrio y metodología desde{" "}
            <Link to="/amigos" className="text-accent">
              Amigos en ruta <ArrowRight className="inline w-3 h-3" />
            </Link>
            .
          </p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <Metric label="Amigos en ruta" value={amigosEnRuta} />
            <Metric
              label="Convertidos"
              value={totalConversiones}
              tone="text-success"
            />
          </div>
        </div>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <form onSubmit={createZone} className="card p-5 flex flex-col gap-2">
          <h2 className="font-medium">Agregar lugar de cobertura</h2>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <select
              className="input-field"
              value={zonaForm.tipo}
              onChange={(event) =>
                setZonaForm({ ...zonaForm, tipo: event.target.value })
              }
            >
              <option value="barrio">Barrio</option>
              <option value="vereda">Vereda</option>
              <option value="sector">Sector</option>
            </select>
            <input
              required
              className="input-field"
              placeholder="Nombre del lugar"
              value={zonaForm.nombre}
              onChange={(event) =>
                setZonaForm({ ...zonaForm, nombre: event.target.value })
              }
            />
          </div>
          <p className="text-xs text-secondary">
            El responsable se asigna en Equipo de trabajo y la actividad quedará asociada a esta zona.
          </p>
          <button className="btn-primary justify-center">
            <Plus className="w-4 h-4" /> Crear cobertura
          </button>
        </form>
        <form onSubmit={createMethod} className="card p-5 flex flex-col gap-2">
          <h2 className="font-medium">Agregar metodología</h2>
          <p className="text-xs text-secondary">
            Estará disponible como actividad de Evangelismo.
          </p>
          <input
            required
            className="input-field"
            placeholder="Ej. Escuela bíblica"
            value={metodoForm}
            onChange={(event) => setMetodoForm(event.target.value)}
          />
          <button className="btn-secondary justify-center">
            <Plus className="w-4 h-4" /> Crear metodología
          </button>
        </form>
      </section>
      {editingZoneId && <div className="modal-backdrop"><form onSubmit={updateZone} className="modal-panel"><h2 className="font-medium">Editar cobertura territorial</h2><input autoFocus required className="input-field mt-4" value={zoneEditName} onChange={(event) => setZoneEditName(event.target.value)} /><select className="input-field mt-2" value={zoneEditLeader} onChange={(event) => setZoneEditLeader(event.target.value)}><option value="">Sin líder asignado</option>{personas.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingZoneId(null)} className="btn-secondary">Cancelar</button><button disabled={!canEdit} className="btn-primary">Guardar</button></div></form></div>}
    </div>
  );
}
