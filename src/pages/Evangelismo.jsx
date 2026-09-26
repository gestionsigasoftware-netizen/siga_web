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
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import { geocodeAddress } from "../lib/geocoding";
import GeoMap from "../components/charts/GeoMap";
import InfoTip from "../components/InfoTip";
import ChartEmpty from "../components/ChartEmpty";
import ExportButtons from "../components/ExportButtons";
import Toast from "../components/Toast";
import { descargarCsv, descargarExcel, descargarPdf } from "../lib/reportExport";

ChartJS.register(
  BarElement,
  CategoryScale,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);
const CHART_OPTIONS = chartOptions();

const evangelismoCache = new Map();

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
  const { t } = useTranslation();
  const PERIODOS = [
    ["30", t("evangelismo.periodo30")],
    ["180", t("evangelismo.periodo6m")],
    ["365", t("evangelismo.periodo12m")],
  ];
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
  const [canEdit, setCanEdit] = useState(null); // null = todavia no se confirma el permiso
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
      setError(t("evangelismo.sinCongregacion"));
      return;
    }
    const cacheKey = `${congregacionId}:${periodo}`;
    const cached = evangelismoCache.get(cacheKey);
    if (cached) {
      setModulo(cached.modulo);
      setZonas(cached.zonas);
      setMetodos(cached.metodos);
      setRegistros(cached.registros);
      setAmigos(cached.amigos);
      setPersonas(cached.personas);
      setMetodosEstacion(cached.metodosEstacion);
      setDiagnosticos(cached.diagnosticos);
      setLoading(false);
    } else {
      setLoading(true);
    }
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
        setError(t("evangelismo.errorCargar"));
      const loadedModule = moduleResult.data;
      const newZonas = (zonesResult.data ?? []).filter(
        (zone) => !loadedModule?.id || zone.modulo_id === loadedModule.id,
      );
      const newMetodos = (loadedModule?.tipos_actividad ?? []).filter(
        (method) => method.activo !== false,
      );
      const newRegistros = (recordsResult.data ?? []).filter(
        (record) => !loadedModule?.id || record.modulo_id === loadedModule.id,
      );
      const newAmigos = friendsResult.data ?? [];
      const newPersonas = peopleResult.data ?? [];
      const newMetodosEstacion = estacionesResult.data ?? null;
      const newDiagnosticos = diagnosticosResult.data ?? [];
      setModulo(loadedModule);
      setZonas(newZonas);
      setMetodos(newMetodos);
      setRegistros(newRegistros);
      setAmigos(newAmigos);
      setPersonas(newPersonas);
      setMetodosEstacion(newMetodosEstacion);
      setDiagnosticos(newDiagnosticos);
      evangelismoCache.set(cacheKey, {
        modulo: loadedModule,
        zonas: newZonas,
        metodos: newMetodos,
        registros: newRegistros,
        amigos: newAmigos,
        personas: newPersonas,
        metodosEstacion: newMetodosEstacion,
        diagnosticos: newDiagnosticos,
      });
    } catch (loadError) {
      setError(t("evangelismo.errorCargarMensaje", { mensaje: loadError.message }));
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
        enRuta: amigos.filter(
          (friend) => !friend.convertido && friend.zona_id === zone.id,
        ).length,
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
    ? t("evangelismo.insightLiderZona", { zona: liderZona.nombre, cantidad: liderZona.conversiones })
    : amigosEnRuta
      ? t("evangelismo.insightAmigosEnRuta", { count: amigosEnRuta })
      : t("evangelismo.insightSinDatos");
  const alerts = [
    ...zonaRows.filter((row) => row.registros === 0).map((row) => ({ title: t("evangelismo.alertaSinActividadTitulo", { zona: row.nombre }), detail: t("evangelismo.alertaSinActividadDetalle"), tone: "danger" })),
    ...zonaRows.filter((row) => row.registros > 0 && row.asistencia / row.registros < 5).map((row) => ({ title: t("evangelismo.alertaBajaAsistenciaTitulo", { zona: row.nombre }), detail: t("evangelismo.alertaBajaAsistenciaDetalle", { cantidad: Math.round(row.asistencia / row.registros) }), tone: "warning" })),
    ...(totalAsistencia > 0 && conversionRate < 5 ? [{ title: t("evangelismo.alertaConversionBajaTitulo"), detail: t("evangelismo.alertaConversionBajaDetalle", { pct: conversionRate }), tone: "warning" }] : []),
    ...(amigosSinZona ? [{ title: t("evangelismo.alertaSinTerritorioTitulo"), detail: t("evangelismo.alertaSinTerritorioDetalle", { cantidad: amigosSinZona }), tone: "danger" }] : []),
  ];

  function exportResumen() {
    return {
      kpis: [
        { label: t("evangelismo.exportCapturasMoviles"), value: visibles.length },
        { label: t("evangelismo.exportAsistenciaPromedio"), value: promedio },
        { label: t("evangelismo.exportAmigosEnRuta"), value: amigosEnRuta },
        { label: t("evangelismo.exportConversiones"), value: totalConversiones },
      ],
      desgloses: [{ titulo: t("evangelismo.exportConversionesPorZona"), items: zonaRows.map((row) => ({ label: row.nombre, valor: row.conversiones })) }],
    };
  }
  function exportHeaders() {
    return {
      headers: [t("evangelismo.exportColLugar"), t("evangelismo.exportColCapturas"), t("evangelismo.exportColAsistencia"), t("evangelismo.exportColConversiones"), t("evangelismo.exportColAmigosEnRuta"), t("evangelismo.exportColResponsable")],
      rows: zonaRows.map((row) => [row.nombre, row.registros, row.asistencia, row.conversiones, row.enRuta, row.personas ? `${row.personas.nombres} ${row.personas.apellidos}` : t("evangelismo.sinAsignar")]),
    };
  }
  function exportCsv() { descargarCsv({ filename: `evangelismo-${hoyBogota()}.csv`, titulo: t("evangelismo.exportTitulo"), ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `evangelismo-${hoyBogota()}.xlsx`, hoja: t("evangelismo.exportHoja"), titulo: t("evangelismo.exportTitulo"), resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `evangelismo-${hoyBogota()}.pdf`, titulo: t("evangelismo.exportTitulo"), orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

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
      setError(t("evangelismo.errorCrearCobertura", { mensaje: result.error.message }));
    else {
      setNotice(t("evangelismo.coberturaCreada"));
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
      setError(t("evangelismo.errorCrearMetodologia", { mensaje: result.error.message }));
    else {
      setNotice(t("evangelismo.metodologiaCreada"));
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
    if (result.error) setError(t("evangelismo.errorActualizarZona", { mensaje: result.error.message }));
    else { setNotice(t("evangelismo.zonaActualizada")); setEditingZoneId(null); load(); }
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
      if (procesoResult.error) { setError(t("evangelismo.errorIniciarMetodos", { mensaje: procesoResult.error.message })); return; }
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
    if (result.error) { setError(t("evangelismo.errorRegistrarDiagnostico", { mensaje: result.error.message })); return; }
    setNotice(t("evangelismo.diagnosticoRegistrado"));
    setDiagnosticoForm({ zona_id: "", responsable_persona_id: "", periodo_inicio: "", periodo_fin: "", poblacion_estimada: "", necesidades: "", recursos: "", estrategia: "", comite_responsable: "", resultado: "" });
    load();
  }

  if (roleLoading || loading)
    return (
      <div className="module-loading" role="status">
        <span className="loading-dot" />
        {t("evangelismo.cargando")}
      </div>
    );
  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to="/misiones-evangelismo" className="btn-secondary mb-4">
            <ArrowLeft className="w-4 h-4" />
            {t("evangelismo.volverMisiones")}
          </Link>
          <p className="eyebrow">{t("evangelismo.eyebrow")}</p>
          <h1 className="section-title">{t("evangelismo.titulo")}</h1>
          <p className="text-sm text-secondary mt-1">
            {t("evangelismo.subtitulo")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex gap-1.5"
            role="group"
            aria-label={t("evangelismo.periodoAnalisis")}
          >
            {PERIODOS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriodo(value)}
                className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-night text-white border-night" : "border-border text-secondary"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
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
      <Toast>{notice}</Toast>
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label={t("evangelismo.metricLugaresCobertura")} value={zonas.length} />
        <Metric label={t("evangelismo.metricCapturasMoviles")} value={visibles.length} info={t("evangelismo.capturasTip")} />
        <Metric label={t("evangelismo.metricAsistenciaPromedio")} value={promedio} />
        <Metric label={t("evangelismo.metricAmigosEnRuta")} value={amigosEnRuta} info={t("evangelismo.amigosEnRutaTip")} />
        <Metric
          label={t("evangelismo.metricConversiones")}
          value={totalConversiones}
          tone={totalConversiones ? "text-success" : ""}
          info={t("evangelismo.conversionesTip")}
        />
        <Metric label={t("evangelismo.metricConversionAsistente")} value={`${conversionRate}%`} detail={t("evangelismo.detalleIndicadorReferencia")} info={t("evangelismo.conversionAsistenteTip")} />
      </section>
      <section className="card p-5">
        <div className="flex items-start gap-3 pb-4 border-b border-border">
          <span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0"><Target className="w-4 h-4" /></span>
          <div><p className="eyebrow">{t("evangelismo.analisisTerritorial")}</p><h2 className="font-medium mt-1">{t("evangelismo.filtrosParaDecidir")}</h2><p className="text-xs text-secondary mt-1">{t("evangelismo.filtrosDesc")}</p></div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <label className="text-xs text-secondary">{t("evangelismo.barrioVeredaSector")}
            <select aria-label={t("evangelismo.filtrarPorBarrio")} className="input-field mt-1.5" value={zonaFiltro} onChange={(event) => setZonaFiltro(event.target.value)}>
              <option value="todos">{t("evangelismo.todosBarriosVeredas")}</option>
              {zonas.map((zone) => <option key={zone.id} value={zone.id}>{zone.nombre}</option>)}
            </select>
          </label>
          <label className="text-xs text-secondary">{t("evangelismo.metodologiaUtilizada")}
            <select aria-label={t("evangelismo.filtrarPorMetodologia")} className="input-field mt-1.5" value={metodoFiltro} onChange={(event) => setMetodoFiltro(event.target.value)}>
              <option value="todos">{t("evangelismo.todasMetodologias")}</option>
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
          <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{t("evangelismo.senalesGestion")}</p><h2 className="font-medium mt-1">{t("evangelismo.alertasParaActuar")}</h2></div><span className="chart-highlight">{alerts.length}</span></div>
          <div className="grid md:grid-cols-2 gap-3 mt-4">{alerts.slice(0, 6).map((alert) => <div key={alert.title} className={`rounded p-3 ${alert.tone === "danger" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning"}`}><p className="text-sm font-medium">{alert.title}</p><p className="text-xs mt-1">{alert.detail}</p></div>)}</div>
        </section>
      )}
      <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("evangelismo.actividadRegistrada")}</p>
          <h2 className="font-medium mt-1">{t("evangelismo.asistenciaPorCaptura")}</h2>
          <div className="h-56 mt-4">
            {tendencia.length ? (
              <Line
                data={trendDataset(tendencia.map((item) => item.fecha), tendencia.map((item) => item.total), { label: t("evangelismo.asistentesLabel") })}
                options={CHART_OPTIONS}
              />
            ) : (
              <ChartEmpty message={t("evangelismo.sinCapturasRegistradas")} />
            )}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("evangelismo.eficacia")}</p>
          <h2 className="font-medium mt-1">{t("evangelismo.conversionesPorMetodologia")}</h2>
          <div className="h-56 mt-4">
            {metodoRows.length ? (
              <Bar
                data={distributionDataset(metodoRows, { labelKey: "nombre", valueKey: "conversiones", datasetLabel: t("evangelismo.conversionesLabel") })}
                options={CHART_OPTIONS}
              />
            ) : (
              <ChartEmpty message={t("evangelismo.sinMetodologiasConversion")} />
            )}
          </div>
          {liderMetodo && (
            <p className="summary-insight mt-3">
              {t("evangelismo.liderMetodoInsight", { nombre: liderMetodo.nombre })}
            </p>
          )}
        </div>
      </section>
      {convertidosConTiempo.length > 0 && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card chart-card p-5">
            <p className="eyebrow">{t("evangelismo.efectividad")}</p>
            <h2 className="font-medium mt-1">{t("evangelismo.diasHastaBautismoMetodo")}</h2>
            <p className="text-xs text-secondary mt-1">{t("evangelismo.diasHastaBautismoDesc")}</p>
            <div className="h-56 mt-4">{tiempoConversionMetodo.length ? <Bar data={distributionDataset(tiempoConversionMetodo, { labelKey: "nombre", valueKey: "promedio", datasetLabel: t("evangelismo.diasPromedioLabel") })} options={CHART_OPTIONS} /> : <p className="text-sm text-muted py-10 text-center">{t("evangelismo.sinConversionesMetodologia")}</p>}</div>
            {metodoMasRapido && <p className="summary-insight mt-3">{t("evangelismo.metodoMasRapidoInsight", { nombre: metodoMasRapido.nombre, dias: metodoMasRapido.promedio, count: metodoMasRapido.total })}</p>}
          </div>
          <div className="card chart-card p-5">
            <p className="eyebrow">{t("evangelismo.efectividad")}</p>
            <h2 className="font-medium mt-1">{t("evangelismo.diasHastaBautismoZona")}</h2>
            <p className="text-xs text-secondary mt-1">{t("evangelismo.diasHastaBautismoZonaDesc")}</p>
            <div className="h-56 mt-4">{tiempoConversionZona.length ? <Bar data={distributionDataset(tiempoConversionZona, { labelKey: "nombre", valueKey: "promedio", datasetLabel: t("evangelismo.diasPromedioLabel") })} options={CHART_OPTIONS} /> : <p className="text-sm text-muted py-10 text-center">{t("evangelismo.sinConversionesZona")}</p>}</div>
          </div>
        </section>
      )}
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{t("evangelismo.coberturaTerritorial")}</p>
              <h2 className="font-medium mt-1">
                {t("evangelismo.rendimientoPorBarrio")}
              </h2>
            </div>
            <MapPinned className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-2">{t("evangelismo.colLugar")}</th>
                  <th className="py-2 text-right">{t("evangelismo.colCapturas")}</th>
                  <th className="py-2 text-right">{t("evangelismo.colAsist")}</th>
                  <th className="py-2 text-right">{t("evangelismo.colConv")}</th>
                  <th className="py-2 text-right">{t("evangelismo.colResponsable")}</th>
                  <th className="py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {zonaRows.map((row) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="py-2">
                      <p className="font-medium">{row.nombre}</p>
                      <p className="text-xs text-muted">
                        {t("evangelismo.amigosEnRutaSufijo", { cantidad: row.enRuta })}
                      </p>
                    </td>
                    <td className="py-2 text-right">{row.registros}</td>
                    <td className="py-2 text-right">{row.asistencia}</td>
                    <td className="py-2 text-right font-medium text-success">
                      {row.conversiones}
                    </td>
                    <td className="py-2 text-right text-xs text-secondary">
                      {row.personas ? `${row.personas.nombres} ${row.personas.apellidos}` : t("evangelismo.sinAsignar")}
                    </td>
                    <td className="py-2 text-right">{canEdit && <button type="button" className="text-xs text-accent" onClick={() => { setEditingZoneId(row.id); setZoneEditName(row.nombre); setZoneEditLeader(row.lider_persona_id || ""); setZoneEditDireccion(row.direccion || "") }}>{t("evangelismo.editar")}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{t("evangelismo.flujoIndividual")}</p>
              <h2 className="font-medium mt-1">{t("evangelismo.amigosYResponsables")}</h2>
            </div>
            <UsersRound className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-secondary mt-4">
            {t("evangelismo.flujoIndividualDescPre")}
            <Link to="/amigos" className="text-accent">
              {t("evangelismo.amigosEnRutaLink")} <ArrowRight className="inline w-3 h-3" />
            </Link>
            .
          </p>
        </div>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("evangelismo.coberturaTerritorial")}</p>
          <h2 className="font-medium mt-1">{t("evangelismo.amigosAlcanzadosPorZona")}</h2>
          <div className="h-56 mt-4">
            {zonaRows.length ? (
              <Bar data={distributionDataset(zonaRows, { labelKey: "nombre", valueKey: "amigos", datasetLabel: t("evangelismo.amigosAlcanzadosLabel") })} options={CHART_OPTIONS} />
            ) : (
              <p className="text-sm text-muted py-10 text-center">{t("evangelismo.sinZonasRegistradas")}</p>
            )}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("evangelismo.ubicacionGeografica")}</p>
          <h2 className="font-medium mt-1">{t("evangelismo.zonasEnMapa")}</h2>
          <p className="text-xs text-secondary mt-1">{t("evangelismo.zonasMapaDesc")}</p>
          <div className="mt-4">
            <GeoMap points={zonaRows.map((row) => ({ id: row.id, label: row.nombre, valor: row.amigos, latitud: row.latitud, longitud: row.longitud, detalle: t("evangelismo.mapaDetalle", { enRuta: row.enRuta, conversiones: row.conversiones }) }))} height={420} premium colorHex="#5B9BE0" />
          </div>
        </div>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <form onSubmit={createZone} className="card p-5 flex flex-col gap-2">
          <h2 className="font-medium">{t("evangelismo.agregarLugarCobertura")}</h2>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <select
              className="input-field"
              value={zonaForm.tipo}
              onChange={(event) =>
                setZonaForm({ ...zonaForm, tipo: event.target.value })
              }
            >
              <option value="barrio">{t("evangelismo.tipoBarrio")}</option>
              <option value="vereda">{t("evangelismo.tipoVereda")}</option>
              <option value="sector">{t("evangelismo.tipoSector")}</option>
            </select>
            <input
              required
              className="input-field"
              placeholder={t("evangelismo.nombreDelLugar")}
              value={zonaForm.nombre}
              onChange={(event) =>
                setZonaForm({ ...zonaForm, nombre: event.target.value })
              }
            />
          </div>
          <label className="text-sm flex items-center gap-1">
            {t("evangelismo.poblacionEspecial")}
            <InfoTip texto={t("evangelismo.poblacionEspecialTip")} />
            <select
              className="input-field w-full"
              value={zonaForm.tipo_poblacion}
              onChange={(event) => setZonaForm({ ...zonaForm, tipo_poblacion: event.target.value })}
            >
              <option value="general">{t("evangelismo.poblacionGeneral")}</option>
              <option value="carcelaria">{t("evangelismo.poblacionCarcelaria")}</option>
              <option value="salud">{t("evangelismo.poblacionSalud")}</option>
              <option value="indigena">{t("evangelismo.poblacionIndigena")}</option>
            </select>
          </label>
          <label className="text-sm">
            {t("evangelismo.direccionAproximada")} <span className="text-xs text-muted">{t("evangelismo.direccionAproximadaNota")}</span>
            <input
              className="input-field mt-1.5"
              placeholder={t("evangelismo.direccionPlaceholder")}
              value={zonaForm.direccion}
              onChange={(event) => setZonaForm({ ...zonaForm, direccion: event.target.value })}
            />
          </label>
          <p className="text-xs text-secondary">
            {t("evangelismo.responsableEquipoNota")}
          </p>
          <button disabled={geocodificando} className="btn-primary justify-center">
            <Plus className="w-4 h-4" /> {geocodificando ? t("evangelismo.ubicando") : t("evangelismo.crearCobertura")}
          </button>
        </form>
        <form onSubmit={createMethod} className="card p-5 flex flex-col gap-2">
          <h2 className="font-medium">{t("evangelismo.agregarMetodologia")}</h2>
          <p className="text-xs text-secondary">
            {t("evangelismo.metodologiaDisponibleNota")}
          </p>
          <input
            required
            className="input-field"
            placeholder={t("evangelismo.metodologiaPlaceholder")}
            value={metodoForm}
            onChange={(event) => setMetodoForm(event.target.value)}
          />
          <button className="btn-secondary justify-center">
            <Plus className="w-4 h-4" /> {t("evangelismo.crearMetodologia")}
          </button>
        </form>
      </section>

      <section className="card p-5">
        <div className="mb-4"><p className="eyebrow">{t("evangelismo.estacionMetodos")}</p><h2 className="font-medium mt-1 flex items-center gap-1.5">{t("evangelismo.diagnosticoCaracterizacion")}<InfoTip texto={t("evangelismo.diagnosticoCaracterizacionTip")} /></h2><p className="text-xs text-secondary mt-1">{t("evangelismo.diagnosticoDesc")}</p></div>
        {canEdit && <form onSubmit={createDiagnostico} className="grid md:grid-cols-2 gap-3 mb-5">
          <label className="text-sm">{t("evangelismo.zona")}<select required className="input-field mt-1.5" value={diagnosticoForm.zona_id} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, zona_id: event.target.value })}><option value="">{t("evangelismo.seleccionaZona")}</option>{zonas.map((zona) => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}</select></label>
          <label className="text-sm flex items-center gap-1">{t("evangelismo.responsable")}<InfoTip texto={t("evangelismo.responsableTip")} /><select required className="input-field w-full" value={diagnosticoForm.responsable_persona_id} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, responsable_persona_id: event.target.value })}><option value="">{t("evangelismo.seleccionaResponsable")}</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
          <label className="text-sm">{t("evangelismo.periodoDesde")}<input type="date" className="input-field mt-1.5" value={diagnosticoForm.periodo_inicio} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, periodo_inicio: event.target.value })} /></label>
          <label className="text-sm">{t("evangelismo.periodoHasta")}<input type="date" className="input-field mt-1.5" value={diagnosticoForm.periodo_fin} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, periodo_fin: event.target.value })} /></label>
          <label className="text-sm">{t("evangelismo.poblacionEstimada")}<input type="number" min="0" className="input-field mt-1.5" value={diagnosticoForm.poblacion_estimada} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, poblacion_estimada: event.target.value })} /></label>
          <label className="text-sm flex items-center gap-1">{t("evangelismo.comiteResponsable")}<InfoTip texto={t("evangelismo.comiteResponsableTip")} /><input className="input-field w-full" value={diagnosticoForm.comite_responsable} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, comite_responsable: event.target.value })} /></label>
          <label className="text-sm md:col-span-2">{t("evangelismo.necesidadesIdentificadas")}<textarea className="input-field mt-1.5 min-h-16" value={diagnosticoForm.necesidades} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, necesidades: event.target.value })} /></label>
          <label className="text-sm md:col-span-2">{t("evangelismo.recursosDisponibles")}<textarea className="input-field mt-1.5 min-h-16" value={diagnosticoForm.recursos} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, recursos: event.target.value })} /></label>
          <label className="text-sm md:col-span-2">{t("evangelismo.estrategiaElegida")}<textarea className="input-field mt-1.5 min-h-16" value={diagnosticoForm.estrategia} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, estrategia: event.target.value })} /></label>
          <label className="text-sm md:col-span-2">{t("evangelismo.resultado")}<input className="input-field mt-1.5" value={diagnosticoForm.resultado} onChange={(event) => setDiagnosticoForm({ ...diagnosticoForm, resultado: event.target.value })} /></label>
          <div className="md:col-span-2 flex justify-end"><button className="btn-primary" disabled={!metodosEstacion}><Plus className="w-4 h-4" />{t("evangelismo.registrarDiagnostico")}</button></div>
        </form>}
        {diagnosticos.length ? <div className="divide-y divide-border">{diagnosticos.map((item) => <div key={item.id} className="py-3"><p className="text-sm font-medium">{item.zonas?.nombre || t("evangelismo.sinZonaLabel")}{item.periodo_inicio ? (item.periodo_fin ? t("evangelismo.periodoRango", { inicio: item.periodo_inicio, fin: item.periodo_fin }) : t("evangelismo.periodoSoloInicio", { inicio: item.periodo_inicio })) : ""}</p><p className="text-xs text-secondary mt-1">{item.personas ? t("evangelismo.responsableLinea", { nombre: `${item.personas.nombres} ${item.personas.apellidos}` }) : ""}{item.poblacion_estimada ? t("evangelismo.poblacionEstimadaLinea", { cantidad: item.poblacion_estimada }) : ""}</p>{item.estrategia && <p className="text-xs text-muted mt-1">{t("evangelismo.estrategiaLinea", { texto: item.estrategia })}</p>}{item.resultado && <p className="text-xs text-muted mt-1">{t("evangelismo.resultadoLinea", { texto: item.resultado })}</p>}</div>)}</div> : <p className="text-sm text-muted py-4">{t("evangelismo.sinDiagnosticos")}</p>}
      </section>

      <section className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><p className="eyebrow">{t("evangelismo.estacionRefam")}</p><h2 className="font-medium mt-1">{t("evangelismo.gruposParticipantesReuniones")}</h2><p className="text-xs text-secondary mt-1">{t("evangelismo.refamMovidoNota")}</p></div>
        <Link to="/refam" className="btn-secondary whitespace-nowrap">{t("evangelismo.verEstacionRefam")}<ArrowRight className="w-4 h-4" /></Link>
      </section>
      {editingZoneId && <div className="modal-backdrop"><form onSubmit={updateZone} className="modal-panel"><h2 className="font-medium">{t("evangelismo.editarCoberturaTerritorial")}</h2><input autoFocus required className="input-field mt-4" value={zoneEditName} onChange={(event) => setZoneEditName(event.target.value)} /><select className="input-field mt-2" value={zoneEditLeader} onChange={(event) => setZoneEditLeader(event.target.value)}><option value="">{t("evangelismo.sinLiderAsignado")}</option>{personas.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}</select><input className="input-field mt-2" placeholder={t("evangelismo.direccionAproximadaMapa")} value={zoneEditDireccion} onChange={(event) => setZoneEditDireccion(event.target.value)} /><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditingZoneId(null)} className="btn-secondary">{t("evangelismo.cancelar")}</button><button disabled={!canEdit || geocodificando} className="btn-primary">{geocodificando ? t("evangelismo.ubicando") : t("evangelismo.guardar")}</button></div></form></div>}
    </div>
  );
}
