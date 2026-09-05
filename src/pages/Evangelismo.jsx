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
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import { geocodeAddress } from "../lib/geocoding";
import GeoMap from "../components/charts/GeoMap";
import InfoTip from "../components/InfoTip";

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
const CHART_OPTIONS = chartOptions();

function Metric({ label, value, detail, tone = "", info }) {
  return (
    <div className="stat-tile">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">
        {label}
        {info && <InfoTip texto={info} />}
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

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const [canEdit, setCanEdit] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [zoneEditName, setZoneEditName] = useState("");
  const [zoneEditLeader, setZoneEditLeader] = useState("");
  const [zoneEditDireccion, setZoneEditDireccion] = useState("");
  const [geocodificando, setGeocodificando] = useState(false);
  const [zonaForm, setZonaForm] = useState({
    nombre: "",
    tipo: "barrio",
    responsable_id: "",
    tipo_poblacion: "general",
    direccion: "",
  });
  const [metodoForm, setMetodoForm] = useState("");
  const [metodosEstacion, setMetodosEstacion] = useState(null);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [diagnosticoForm, setDiagnosticoForm] = useState({
    zona_id: "",
    responsable_persona_id: "",
    periodo_inicio: "",
    periodo_fin: "",
    poblacion_estimada: "",
    necesidades: "",
    recursos: "",
    estrategia: "",
    comite_responsable: "",
    resultado: "",
  });

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
      const startKey = fechaBogota(start);
      const [
        moduleResult,
        zonesResult,
        recordsResult,
        friendsResult,
        peopleResult,
        estacionesResult,
        diagnosticosResult,
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
            "id, nombre, modulo_id, lider_persona_id, tipo_poblacion, direccion, latitud, longitud, personas:lider_persona_id(nombres, apellidos)",
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
          .select("id, convertido, zona_id, evangelismo_metodologia_id, fecha_primer_contacto, fecha_bautismo, zonas(nombre)")
          .eq("congregacion_id", congregacionId),
        supabase
          .from("personas")
          .select("id, nombres, apellidos")
          .eq("congregacion_id", congregacionId)
          .eq("estado_membresia", "activo")
          .order("nombres"),
        supabase
          .from("ruta_estaciones")
          .select("id, codigo")
          .eq("congregacion_id", congregacionId)
          .eq("codigo", "metodos")
          .maybeSingle(),
        supabase
          .from("ruta_diagnosticos")
          .select("id, periodo_inicio, periodo_fin, poblacion_estimada, necesidades, recursos, estrategia, comite_responsable, resultado, zona_id, responsable_persona_id, zonas(nombre), personas:responsable_persona_id(nombres, apellidos)")
          .eq("congregacion_id", congregacionId)
          .order("created_at", { ascending: false }),
      ]);
      if (
        moduleResult.error ||
        zonesResult.error ||
        recordsResult.error ||
        friendsResult.error ||
        peopleResult.error ||
        estacionesResult.error ||
        diagnosticosResult.error
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
      setMetodosEstacion(estacionesResult.data ?? null);
      setDiagnosticos(diagnosticosResult.data ?? []);
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
  const convertidosConTiempo = amigos
    .filter((friend) => friend.convertido && friend.fecha_primer_contacto && friend.fecha_bautismo)
    .map((friend) => ({ ...friend, dias: Math.round((new Date(friend.fecha_bautismo) - new Date(friend.fecha_primer_contacto)) / 86400000) }))
    .filter((friend) => friend.dias >= 0);
  const promedioDiasPorGrupo = (key, catalogo) => catalogo
    .map((item) => {
      const rows = convertidosConTiempo.filter((friend) => friend[key] === item.id);
      return rows.length ? { nombre: item.nombre, promedio: Math.round(rows.reduce((sum, friend) => sum + friend.dias, 0) / rows.length), total: rows.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.promedio - b.promedio);
  const tiempoConversionMetodo = promedioDiasPorGrupo("evangelismo_metodologia_id", metodos);
  const tiempoConversionZona = promedioDiasPorGrupo("zona_id", zonas);
  const metodoMasRapido = tiempoConversionMetodo[0];
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
    setGeocodificando(true);
    const ubicacion = zonaForm.direccion.trim() ? await geocodeAddress(zonaForm.direccion.trim()) : null;
    setGeocodificando(false);
    const result = await supabase
      .from("zonas")
      .insert({
        congregacion_id: congregacionId,
        modulo_id: modulo.id,
        nombre: `${zonaForm.tipo}: ${zonaForm.nombre.trim()}`,
        lider_persona_id: zonaForm.responsable_id || null,
        tipo_poblacion: zonaForm.tipo_poblacion,
        direccion: zonaForm.direccion.trim() || null,
        latitud: ubicacion?.latitud ?? null,
        longitud: ubicacion?.longitud ?? null,
      });
    if (result.error)
      setError(`No se pudo crear la cobertura: ${result.error.message}`);
    else {
      setNotice("Lugar de cobertura creado.");
      setZonaForm({ nombre: "", tipo: "barrio", responsable_id: "", tipo_poblacion: "general", direccion: "" });
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
    setGeocodificando(true);
    const ubicacion = zoneEditDireccion.trim() ? await geocodeAddress(zoneEditDireccion.trim()) : null;
    setGeocodificando(false);
    const result = await supabase.from("zonas").update({
      nombre: zoneEditName.trim(),
      lider_persona_id: zoneEditLeader || null,
      direccion: zoneEditDireccion.trim() || null,
      latitud: ubicacion?.latitud ?? null,
      longitud: ubicacion?.longitud ?? null,
    }).eq("id", editingZoneId).eq("congregacion_id", congregacionId);
    if (result.error) setError(`No se pudo actualizar la zona: ${result.error.message}`);
    else { setNotice("Zona actualizada."); setEditingZoneId(null); load(); }
  }

  async function createDiagnostico(event) {
    event.preventDefault();
    if (!canEdit || !metodosEstacion || !diagnosticoForm.zona_id || !diagnosticoForm.responsable_persona_id) return;
    setError(null);
    const existing = await supabase
      .from("ruta_procesos")
      .select("id")
      .eq("congregacion_id", congregacionId)
      .eq("estacion_id", metodosEstacion.id)
      .eq("persona_id", diagnosticoForm.responsable_persona_id)
      .in("estado", ["activo", "pausado"])
      .maybeSingle();
    let procesoId = existing.data?.id;
    if (!procesoId) {
      const procesoResult = await supabase
        .from("ruta_procesos")
        .insert({ congregacion_id: congregacionId, estacion_id: metodosEstacion.id, persona_id: diagnosticoForm.responsable_persona_id, responsable_persona_id: diagnosticoForm.responsable_persona_id, fecha_inicio: diagnosticoForm.periodo_inicio || hoyBogota() })
        .select("id")
        .single();
      if (procesoResult.error) { setError(`No se pudo iniciar el proceso de Métodos: ${procesoResult.error.message}`); return; }
      procesoId = procesoResult.data.id;
    }
    const result = await supabase.from("ruta_diagnosticos").insert({
      congregacion_id: congregacionId,
      proceso_id: procesoId,
      zona_id: diagnosticoForm.zona_id,
      responsable_persona_id: diagnosticoForm.responsable_persona_id,
      periodo_inicio: diagnosticoForm.periodo_inicio || null,
      periodo_fin: diagnosticoForm.periodo_fin || null,
      poblacion_estimada: diagnosticoForm.poblacion_estimada ? Number(diagnosticoForm.poblacion_estimada) : null,
      necesidades: diagnosticoForm.necesidades.split("\n").map((item) => item.trim()).filter(Boolean),
      recursos: diagnosticoForm.recursos.split("\n").map((item) => item.trim()).filter(Boolean),
      estrategia: diagnosticoForm.estrategia.trim() || null,
      comite_responsable: diagnosticoForm.comite_responsable.trim() || null,
      resultado: diagnosticoForm.resultado.trim() || null,
    });
    if (result.error) { setError(`No se pudo registrar el diagnóstico: ${result.error.message}`); return; }
    setNotice("Diagnóstico de Métodos registrado.");
    setDiagnosticoForm({ zona_id: "", responsable_persona_id: "", periodo_inicio: "", periodo_fin: "", poblacion_estimada: "", necesidades: "", recursos: "", estrategia: "", comite_responsable: "", resultado: "" });
    load();
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
        <Metric label="Amigos en ruta" value={amigosEnRuta} info="Personas que ya tuvieron un primer contacto pero todavía no se han bautizado." />
        <Metric
          label="Conversiones"
          value={totalConversiones}
          tone="text-success"
        />
        <Metric label="Conversión / asistente" value={`${conversionRate}%`} detail="Indicador de referencia" info="Compara el total de conversiones con el total de asistentes a capturas en este periodo. Es una referencia general, no mide el seguimiento de cada persona en particular." />
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
              data={trendDataset(tendencia.map((item) => item.fecha), tendencia.map((item) => item.total), { label: "Asistentes" })}
              options={CHART_OPTIONS}
            />
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Eficacia</p>
          <h2 className="font-medium mt-1">Conversiones por metodología</h2>
          <div className="h-56 mt-4">
            <Bar
              data={distributionDataset(metodoRows, { labelKey: "nombre", valueKey: "conversiones", datasetLabel: "Conversiones" })}
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
      {convertidosConTiempo.length > 0 && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card chart-card p-5">
            <p className="eyebrow">Efectividad</p>
            <h2 className="font-medium mt-1">Días hasta el bautismo, por metodología</h2>
            <p className="text-xs text-secondary mt-1">Desde el primer contacto hasta el bautismo. Menos días = metodología más efectiva en este periodo.</p>
            <div className="h-56 mt-4">{tiempoConversionMetodo.length ? <Bar data={distributionDataset(tiempoConversionMetodo, { labelKey: "nombre", valueKey: "promedio", datasetLabel: "Días promedio" })} options={CHART_OPTIONS} /> : <p className="text-sm text-muted py-10 text-center">Aún no hay conversiones con metodología registrada.</p>}</div>
            {metodoMasRapido && <p className="summary-insight mt-3">{metodoMasRapido.nombre} convierte en promedio en {metodoMasRapido.promedio} días ({metodoMasRapido.total} caso{metodoMasRapido.total === 1 ? "" : "s"}) -- la metodología más rápida en este periodo.</p>}
          </div>
          <div className="card chart-card p-5">
            <p className="eyebrow">Efectividad</p>
            <h2 className="font-medium mt-1">Días hasta el bautismo, por zona</h2>
            <p className="text-xs text-secondary mt-1">Compara qué líder/barrio logra conversiones más rápidas.</p>
            <div className="h-56 mt-4">{tiempoConversionZona.length ? <Bar data={distributionDataset(tiempoConversionZona, { labelKey: "nombre", valueKey: "promedio", datasetLabel: "Días promedio" })} options={CHART_OPTIONS} /> : <p className="text-sm text-muted py-10 text-center">Aún no hay conversiones con zona registrada.</p>}</div>
          </div>
        </section>
      )}
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
                    <td className="py-2 text-right">{canEdit && <button type="button" className="text-xs text-accent" onClick={() => { setEditingZoneId(row.id); setZoneEditName(row.nombre); setZoneEditLeader(row.lider_persona_id || ""); setZoneEditDireccion(row.direccion || "") }}>Editar</button>}</td>
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
        <div className="card chart-card p-5">
          <p className="eyebrow">Cobertura territorial</p>
          <h2 className="font-medium mt-1">Amigos alcanzados por zona</h2>
          <div className="h-56 mt-4">
            {zonaRows.length ? (
              <Bar data={distributionDataset(zonaRows, { labelKey: "nombre", valueKey: "amigos", datasetLabel: "Amigos alcanzados" })} options={CHART_OPTIONS} />
            ) : (
              <p className="text-sm text-muted py-10 text-center">Aún no hay zonas registradas.</p>
            )}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Ubicación geográfica</p>
          <h2 className="font-medium mt-1">Zonas en el mapa</h2>
          <p className="text-xs text-secondary mt-1">Solo aparecen las zonas con dirección registrada. El tamaño del punto es proporcional a los amigos alcanzados.</p>
          <div className="mt-4">
            <GeoMap points={zonaRows.map((row) => ({ id: row.id, label: row.nombre, valor: row.amigos, latitud: row.latitud, longitud: row.longitud, detalle: `${row.amigos} amigos en ruta · ${row.conversiones} conversiones` }))} />
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
          <label className="text-sm flex items-center gap-1">
            Población especial
            <InfoTip texto="Marca esta opción si la zona corresponde a un grupo con ministerio propio, como cárceles o centros de salud, para que quede identificada por su contexto." />
            <select
              className="input-field w-full"
              value={zonaForm.tipo_poblacion}
              onChange={(event) => setZonaForm({ ...zonaForm, tipo_poblacion: event.target.value })}
            >
              <option value="general">General</option>
              <option value="carcelaria">Carcelaria</option>
              <option value="salud">Salud (hospitales)</option>
              <option value="indigena">Indígena</option>
            </select>
          </label>
          <label className="text-sm">
            Dirección aproximada <span className="text-xs text-muted">(opcional, para verla en el mapa)</span>
            <input
              className="input-field mt-1.5"
              placeholder="Calle 5 #23-10, Barrio San Fernando"
              value={zonaForm.direccion}
              onChange={(event) => setZonaForm({ ...zonaForm, direccion: event.target.value })}
            />
          </label>
          <p className="text-xs text-secondary">
            El responsable se asigna en Equipo de trabajo y la actividad quedará asociada a esta zona.
          </p>
          <button disabled={geocodificando} className="btn-primary justify-center">
            <Plus className="w-4 h-4" /> {geocodificando ? 'Ubicando...' : 'Crear cobertura'}
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

      <section className="card p-5">
        <div className="mb-4"><p className="eyebrow">Estación Métodos</p><h2 className="font-medium mt-1 flex items-center gap-1.5">Diagnóstico de caracterización territorial<InfoTip texto="Métodos es la primera estación de la Ruta Evangelística: estudia una zona antes de empezar el trabajo evangelístico, para elegir la estrategia correcta." /></h2><p className="text-xs text-secondary mt-1">Registra el diagnóstico de una zona antes de iniciar el trabajo evangelístico.</p></div>
        {canEdit && <form onSubmit={createDiagnostico} className="grid md:grid-cols-2 gap-3 mb-5">
          <label className="text-sm">Zona<select required className="input-field mt-1.5" value={diagnosticoForm.zona_id} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, zona_id: event.target.value })}><option value="">Selecciona una zona</option>{zonas.map((zona) => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}</select></label>
          <label className="text-sm flex items-center gap-1">Responsable<InfoTip texto="Quién queda a cargo de este diagnóstico. Al elegirlo, se abre o continúa su proceso en la estación Métodos." /><select required className="input-field w-full" value={diagnosticoForm.responsable_persona_id} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, responsable_persona_id: event.target.value })}><option value="">Selecciona un responsable</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
          <label className="text-sm">Periodo desde<input type="date" className="input-field mt-1.5" value={diagnosticoForm.periodo_inicio} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, periodo_inicio: event.target.value })} /></label>
          <label className="text-sm">Periodo hasta<input type="date" className="input-field mt-1.5" value={diagnosticoForm.periodo_fin} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, periodo_fin: event.target.value })} /></label>
          <label className="text-sm">Población estimada<input type="number" min="0" className="input-field mt-1.5" value={diagnosticoForm.poblacion_estimada} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, poblacion_estimada: event.target.value })} /></label>
          <label className="text-sm flex items-center gap-1">Comité responsable<InfoTip texto="Nombre del comité local de evangelismo que respalda esta estrategia, si aplica." /><input className="input-field w-full" value={diagnosticoForm.comite_responsable} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, comite_responsable: event.target.value })} /></label>
          <label className="text-sm md:col-span-2">Necesidades identificadas (una por línea)<textarea className="input-field mt-1.5 min-h-16" value={diagnosticoForm.necesidades} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, necesidades: event.target.value })} /></label>
          <label className="text-sm md:col-span-2">Recursos disponibles (uno por línea)<textarea className="input-field mt-1.5 min-h-16" value={diagnosticoForm.recursos} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, recursos: event.target.value })} /></label>
          <label className="text-sm md:col-span-2">Estrategia elegida<textarea className="input-field mt-1.5 min-h-16" value={diagnosticoForm.estrategia} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, estrategia: event.target.value })} /></label>
          <label className="text-sm md:col-span-2">Resultado<input className="input-field mt-1.5" value={diagnosticoForm.resultado} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, resultado: event.target.value })} /></label>
          <div className="md:col-span-2 flex justify-end"><button className="btn-primary" disabled={!metodosEstacion}><Plus className="w-4 h-4" />Registrar diagnóstico</button></div>
        </form>}
        {diagnosticos.length ? <div className="divide-y divide-border">{diagnosticos.map((item) => <div key={item.id} className="py-3"><p className="text-sm font-medium">{item.zonas?.nombre || "Sin zona"}{item.periodo_inicio ? ` · ${item.periodo_inicio}${item.periodo_fin ? ` a ${item.periodo_fin}` : ""}` : ""}</p><p className="text-xs text-secondary mt-1">{item.personas ? `Responsable: ${item.personas.nombres} ${item.personas.apellidos}` : ""}{item.poblacion_estimada ? ` · Población estimada: ${item.poblacion_estimada}` : ""}</p>{item.estrategia && <p className="text-xs text-muted mt-1">Estrategia: {item.estrategia}</p>}{item.resultado && <p className="text-xs text-muted mt-1">Resultado: {item.resultado}</p>}</div>)}</div> : <p className="text-sm text-muted py-4">Aún no hay diagnósticos registrados.</p>}
      </section>

      <section className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><p className="eyebrow">Estación REFAM</p><h2 className="font-medium mt-1">Grupos, participantes y reuniones</h2><p className="text-xs text-secondary mt-1">La gestión de REFAM se movió a su propio tablero, con métricas y traslado entre estaciones.</p></div>
        <Link to="/refam" className="btn-secondary whitespace-nowrap">Ver estación REFAM<ArrowRight className="w-4 h-4" /></Link>
      </section>
      {editingZoneId && <div className="modal-backdrop"><form onSubmit={updateZone} className="modal-panel"><h2 className="font-medium">Editar cobertura territorial</h2><input autoFocus required className="input-field mt-4" value={zoneEditName} onChange={(event) => setZoneEditName(event.target.value)} /><select className="input-field mt-2" value={zoneEditLeader} onChange={(event) => setZoneEditLeader(event.target.value)}><option value="">Sin líder asignado</option>{personas.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><input className="input-field mt-2" placeholder="Dirección aproximada (para el mapa)" value={zoneEditDireccion} onChange={(event) => setZoneEditDireccion(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingZoneId(null)} className="btn-secondary">Cancelar</button><button disabled={!canEdit || geocodificando} className="btn-primary">{geocodificando ? 'Ubicando...' : 'Guardar'}</button></div></form></div>}
    </div>
  );
}
