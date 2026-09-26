import { useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { ArrowLeft, ArrowRightLeft, BookOpen, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { hoyBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, distributionDataset, trendDataset } from "../lib/chartTheme";
import { DETALLE_ESTACION, UMBRAL_DIAS_ESTACION, diasDesde, getComitesActivos, getEstacion, iniciarOMoverEstacion, reasignarComiteResponsable, trasladarEstacion } from "../lib/rutaEvangelistica";
import ChartEmpty from "../components/ChartEmpty";
import InfoTip from "../components/InfoTip";
import ExportButtons from "../components/ExportButtons";
import Toast from "../components/Toast";
import { descargarCsv, descargarExcel, descargarPdf } from "../lib/reportExport";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);
const rutaFormacionCache = new Map();
const CHART_OPTIONS = chartOptions();
const TODAY = hoyBogota();

function buildConfig(t) {
  return {
    esfob: {
      title: t("rutaFormacion.esfobTitulo"),
      eyebrow: t("rutaFormacion.esfobEyebrow"),
      description: t("rutaFormacion.esfobDescripcion"),
      table: "esfob_procesos",
      leccionesTabla: "esfob_lecciones",
      progresoTabla: "esfob_progreso_leccion",
      progresoColumna: "esfob_proceso_id",
      notasTabla: "esfob_notas_leccion",
      notasColumna: "esfob_proceso_id",
      responsablePersonaCampo: "responsable_persona_id",
      responsableComiteCampo: "responsable_comite_id",
      defaultProgram: "ESFOB",
      activeState: "en_formacion",
      activeLabel: t("rutaFormacion.esfobActiveLabel"),
    },
    discipulado: {
      title: t("rutaFormacion.discipuladoTitulo"),
      eyebrow: t("rutaFormacion.discipuladoEyebrow"),
      description: t("rutaFormacion.discipuladoDescripcion"),
      table: "discipulado_procesos",
      leccionesTabla: "discipulado_lecciones",
      progresoTabla: "discipulado_progreso_leccion",
      progresoColumna: "discipulado_proceso_id",
      notasTabla: "discipulado_notas_leccion",
      notasColumna: "discipulado_proceso_id",
      responsablePersonaCampo: "mentor_persona_id",
      responsableComiteCampo: "mentor_comite_id",
      defaultProgram: "Discipulado Crecer",
      activeState: "activo",
      activeLabel: t("rutaFormacion.discipuladoActiveLabel"),
    },
  };
}

export default function RutaFormacion({ mode }) {
  const { t, i18n } = useTranslation();
  const ESTADOS_DISCIPULADO = { activo: t("rutaFormacion.estadoActivo"), completado: t("rutaFormacion.estadoCompletado"), pausado: t("rutaFormacion.estadoPausado"), retirado: t("rutaFormacion.estadoRetirado") };
  const CONFIG = buildConfig(t);
  const config = CONFIG[mode];
  const umbral = UMBRAL_DIAS_ESTACION[mode];
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState([]);
  const [friends, setFriends] = useState([]);
  const [estaciones, setEstaciones] = useState([]);
  const [lecciones, setLecciones] = useState([]);
  const [comites, setComites] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(null); // null = todavia no se confirma el permiso
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [trasladoDestino, setTrasladoDestino] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [progreso, setProgreso] = useState([]);
  const [seguimientoForm, setSeguimientoForm] = useState({ servicio_actual: "", siguiente_accion: "", notas: "" });
  const [leccionParaAsignar, setLeccionParaAsignar] = useState("");
  const [notasLeccion, setNotasLeccion] = useState([]);
  const [nuevaNota, setNuevaNota] = useState("");
  const [nuevaNotaResponsable, setNuevaNotaResponsable] = useState("");

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const [form, setForm] = useState({
    subjectId: "",
    responsibleId: "",
    program: config.defaultProgram,
    date: TODAY,
    service: "",
    notes: "",
  });
  const [trasladoComite, setTrasladoComite] = useState({});

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      return;
    }
    const cacheKey = `${congregacionId}:${mode}`;
    const cached = rutaFormacionCache.get(cacheKey);
    if (cached) {
      setRows(cached.rows);
      setPeople(cached.people);
      setFriends(cached.friends);
      setEstaciones(cached.estaciones);
      setLecciones(cached.lecciones);
      setComites(cached.comites);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const [processResult, peopleResult, friendsResult, estacionesResult, leccionesResult, comitesResult] = await Promise.all([
      supabase.from(config.table).select(`*, leccion_actual:${config.leccionesTabla}(numero, titulo), responsable_comite:comites!${config.table}_${config.responsableComiteCampo}_fkey(nombre)`).eq("congregacion_id", congregacionId).order("fecha_inicio", { ascending: false }),
      supabase.from("personas").select("id, nombres, apellidos, bautizado").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("amigos").select("id, nombres, zona_id, comite_origen_id, zonas(nombre)").eq("congregacion_id", congregacionId).eq("convertido", false).order("nombres"),
      supabase.from("ruta_estaciones").select("id, codigo, nombre, orden").eq("congregacion_id", congregacionId).order("orden"),
      supabase.from(config.leccionesTabla).select("id, numero, titulo, descripcion").eq("congregacion_id", congregacionId).eq("activo", true).order("numero"),
      getComitesActivos(congregacionId),
    ]);
    const failed = [processResult, peopleResult, friendsResult].find((result) => result.error);
    if (failed) setError(t("rutaFormacion.errorCargar", { titulo: config.title }));
    const freshData = {
      rows: processResult.data ?? [],
      people: (peopleResult.data ?? []).filter((person) => mode === "esfob" || person.bautizado),
      friends: friendsResult.data ?? [],
      estaciones: estacionesResult.data ?? [],
      lecciones: leccionesResult.data ?? [],
      comites: comitesResult.data ?? [],
    };
    setRows(freshData.rows);
    setPeople(freshData.people);
    setFriends(freshData.friends);
    setEstaciones(freshData.estaciones);
    setLecciones(freshData.lecciones);
    setComites(freshData.comites);
    setLoading(false);
    rutaFormacionCache.set(cacheKey, freshData);
  }

  useEffect(() => { load(); }, [congregacionId, mode]);

  useEffect(() => {
    if (!congregacionId) return;
    const permission = "ruta_evangelistica.editar";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: permission }).then(({ data }) => {
      setCanEdit((rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura") || Boolean(data));
    });
  }, [congregacionId, rolPrincipal]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createProcess(event) {
    event.preventDefault();
    if (!canEdit || !form.subjectId || !form.responsibleId) return;
    setSaving(true);
    setError(null);
    const stationResult = await getEstacion(congregacionId, mode);
    if (stationResult.error) {
      setError(t("rutaFormacion.errorSinEstacion"));
      setSaving(false);
      return;
    }
    const rutaResult = await iniciarOMoverEstacion({
      congregacionId,
      estacionDestino: stationResult.data,
      amigoId: mode === "esfob" ? form.subjectId : null,
      personaId: mode === "discipulado" ? form.subjectId : null,
      responsableComiteId: form.responsibleId || null,
      fechaInicio: form.date,
    });
    if (rutaResult.error) {
      setError(t("rutaFormacion.errorIniciarProceso", { mensaje: rutaResult.error.message }));
      setSaving(false);
      return;
    }
    const detailPayload = mode === "esfob"
      ? {
          congregacion_id: congregacionId,
          proceso_id: rutaResult.data.id,
          amigo_id: form.subjectId,
          responsable_comite_id: rutaResult.responsableComiteId || null,
          programa: form.program,
          lecciones_total: lecciones.length || 1,
          lecciones_completadas: 0,
          leccion_actual_id: lecciones[0]?.id || null,
          fecha_inicio: form.date,
          notas: form.notes || null,
        }
      : {
          congregacion_id: congregacionId,
          proceso_id: rutaResult.data.id,
          persona_id: form.subjectId,
          mentor_comite_id: rutaResult.responsableComiteId || null,
          programa: form.program,
          leccion_actual_id: lecciones[0]?.id || null,
          fecha_inicio: form.date,
          servicio_actual: form.service || null,
          notas: form.notes || null,
        };
    const detailResult = await supabase.from(config.table).insert(detailPayload);
    if (detailResult.error) {
      setError(t("rutaFormacion.errorGuardarDetalle", { mensaje: detailResult.error.message }));
    } else {
      setNotice(t("rutaFormacion.procesoIniciado", { titulo: config.title }));
      setShowForm(false);
      setForm({ subjectId: "", responsibleId: "", program: config.defaultProgram, date: TODAY, service: "", notes: "" });
      load();
    }
    setSaving(false);
  }

  async function trasladar(row) {
    if (!canEdit) return;
    const destinoId = trasladoDestino[row.id];
    const destino = estaciones.find((item) => item.id === destinoId);
    if (!destino) { setError(t("rutaFormacion.errorSeleccionaEstacionDestino")); return; }
    setSaving(true);
    setError(null);
    const nuevoComiteId = trasladoComite[row.id];
    const responsableActualPersonaId = row[config.responsablePersonaCampo];
    const responsableActualComiteId = row[config.responsableComiteCampo];
    const result = await trasladarEstacion({
      congregacionId,
      estacionOrigenCodigo: mode,
      estacionDestino: destino,
      amigoId: mode === "esfob" ? row.amigo_id : null,
      personaId: mode === "discipulado" ? row.persona_id : null,
      responsablePersonaId: nuevoComiteId ? null : responsableActualPersonaId,
      responsableComiteId: nuevoComiteId || responsableActualComiteId || null,
    });
    setSaving(false);
    if (result.error) { setError(t("rutaFormacion.errorTrasladar", { mensaje: result.error.message })); return; }
    setNotice(result.avisoRefam ? t("rutaFormacion.trasladadoConAvisoRefam", { nombre: destino.nombre }) : t("rutaFormacion.trasladado", { nombre: destino.nombre }));
    load();
  }

  // Cambia el comite responsable sin trasladar de estacion -- ej. una
  // persona que pasa de Jovenes a Caballeros al casarse, sin dejar
  // ESFOB/Discipulado. Distinto de trasladar(), que siempre exige un
  // destino nuevo. row.proceso_id es el id en ruta_procesos (esta
  // tabla de detalle lo guarda desde que trasladarEstacion la crea).
  async function reasignarComite(row) {
    if (!canEdit) return;
    const nuevoComiteId = trasladoComite[row.id];
    if (!nuevoComiteId) { setError(t("rutaFormacion.errorSeleccionaComiteSeguimiento")); return; }
    setSaving(true);
    setError(null);
    const result = await reasignarComiteResponsable({ procesoId: row.proceso_id, estacionCodigo: mode, nuevoComiteId });
    setSaving(false);
    if (result.error) { setError(t("rutaFormacion.errorReasignarComite", { mensaje: result.error.message })); return; }
    setNotice(t("rutaFormacion.comiteReasignado"));
    setTrasladoComite({ ...trasladoComite, [row.id]: "" });
    load();
  }

  async function marcarBautizado(row) {
    if (!canEdit || mode !== "esfob") return;
    setSaving(true);
    setError(null);
    const fecha = TODAY;
    const amigoResult = await supabase
      .from("amigos")
      .update({ estado_espiritual: "bautizado", convertido: true, bautizado: true, fecha_bautismo: fecha })
      .eq("id", row.amigo_id);
    if (amigoResult.error) { setSaving(false); setError(t("rutaFormacion.errorRegistrarBautismo", { mensaje: amigoResult.error.message })); return; }
    const procesoResult = await supabase.from("esfob_procesos").update({ estado: "aprobado", fecha_aprobacion: fecha }).eq("id", row.id);
    setSaving(false);
    if (procesoResult.error) { setError(t("rutaFormacion.errorCerrarProcesoEsfob", { mensaje: procesoResult.error.message })); return; }
    setNotice(t("rutaFormacion.bautismoRegistrado"));
    load();
  }

  async function marcarLeccion(row) {
    if (!canEdit || !row.leccion_actual_id) return;
    setSaving(true);
    setError(null);
    const insertResult = await supabase.from(config.progresoTabla).insert({
      [config.progresoColumna]: row.id,
      leccion_id: row.leccion_actual_id,
      responsable_persona_id: row.responsable_persona_id || row.mentor_persona_id || null,
    });
    if (insertResult.error) { setSaving(false); setError(t("rutaFormacion.errorMarcarLeccion", { mensaje: insertResult.error.message })); return; }
    const siguiente = lecciones.find((item) => item.numero === (row.leccion_actual?.numero || 0) + 1);
    const updatePayload = mode === "esfob"
      ? { leccion_actual_id: siguiente?.id || null, lecciones_completadas: Math.min(Number(row.lecciones_total || lecciones.length || 1), Number(row.lecciones_completadas || 0) + 1) }
      : { leccion_actual_id: siguiente?.id || null, lecciones_completadas: Number(row.lecciones_completadas || 0) + 1 };
    const updateResult = await supabase.from(config.table).update(updatePayload).eq("id", row.id);
    setSaving(false);
    if (updateResult.error) { setError(t("rutaFormacion.errorAvanzarLeccion", { mensaje: updateResult.error.message })); return; }
    setNotice(siguiente ? t("rutaFormacion.leccionCompletadaAvanzo", { numero: siguiente.numero }) : t("rutaFormacion.leccionCompletadaTermino", { titulo: config.title }));
    if (row.id === selectedId) refrescarProgreso(row.id);
    load();
  }

  async function refrescarProgreso(procesoId) {
    const { data, error: fetchError } = await supabase
      .from(config.progresoTabla)
      .select(`id, fecha_completada, leccion:${config.leccionesTabla}(numero, titulo)`)
      .eq(config.progresoColumna, procesoId)
      .order("fecha_completada", { ascending: false });
    if (fetchError) { setError(t("rutaFormacion.errorHistorialLecciones")); return; }
    setProgreso(data ?? []);
  }

  async function refrescarNotas(procesoId) {
    const { data, error: fetchError } = await supabase
      .from(config.notasTabla)
      .select(`id, nota, created_at, leccion:${config.leccionesTabla}(numero, titulo), responsable:personas(nombres, apellidos)`)
      .eq(config.notasColumna, procesoId)
      .order("created_at", { ascending: false });
    if (fetchError) { setError(t("rutaFormacion.errorCargarNotas")); return; }
    setNotasLeccion(data ?? []);
  }

  function seleccionarFicha(row) {
    setSelectedId(row.id);
    setSeguimientoForm({ servicio_actual: row.servicio_actual || "", siguiente_accion: row.siguiente_accion || "", notas: row.notas || "" });
    setLeccionParaAsignar("");
    setNuevaNota("");
    setNuevaNotaResponsable(row.responsable_persona_id || row.mentor_persona_id || "");
    refrescarProgreso(row.id);
    refrescarNotas(row.id);
  }

  async function agregarNota(event) {
    event.preventDefault();
    if (!canEdit || !selectedId || !nuevaNota.trim() || !seleccionado?.leccion_actual_id) return;
    setSaving(true);
    setError(null);
    const result = await supabase.from(config.notasTabla).insert({
      [config.notasColumna]: selectedId,
      leccion_id: seleccionado.leccion_actual_id,
      nota: nuevaNota.trim(),
      responsable_persona_id: nuevaNotaResponsable || null,
    });
    setSaving(false);
    if (result.error) { setError(t("rutaFormacion.errorGuardarNota", { mensaje: result.error.message })); return; }
    setNuevaNota("");
    refrescarNotas(selectedId);
  }

  // Cubre el caso de procesos que se crearon cuando el catalogo de
  // lecciones aun estaba vacio (leccion_actual_id quedo en null para
  // siempre) -- deja elegir con cual lección seguir en vez de asumir
  // siempre la #1, por si el responsable ya cubrió contenido antes.
  async function asignarLeccion(row, leccionId) {
    if (!canEdit || !leccionId) return;
    setSaving(true);
    setError(null);
    const result = await supabase.from(config.table).update({ leccion_actual_id: leccionId }).eq("id", row.id);
    setSaving(false);
    if (result.error) { setError(t("rutaFormacion.errorAsignarLeccion", { mensaje: result.error.message })); return; }
    setNotice(t("rutaFormacion.leccionAsignada"));
    setLeccionParaAsignar("");
    load();
  }

  async function guardarSeguimiento(event) {
    event.preventDefault();
    if (!canEdit || !selectedId) return;
    setSaving(true);
    setError(null);
    const result = await supabase.from(config.table).update({
      servicio_actual: seguimientoForm.servicio_actual.trim() || null,
      siguiente_accion: seguimientoForm.siguiente_accion.trim() || null,
      notas: seguimientoForm.notas.trim() || null,
    }).eq("id", selectedId);
    setSaving(false);
    if (result.error) { setError(t("rutaFormacion.errorGuardarSeguimiento", { mensaje: result.error.message })); return; }
    setNotice(t("rutaFormacion.seguimientoActualizado"));
    load();
  }

  const active = rows.filter((row) => row.estado === config.activeState).length;
  const completed = rows.filter((row) => row.estado === "completado" || row.estado === "aprobado").length;
  const totalLessons = rows.reduce((total, row) => total + Number(row.lecciones_completadas || 0), 0);
  const findName = (id) => people.find((person) => person.id === id);
  const findFriend = (id) => friends.find((friend) => friend.id === id);

  const filas = useMemo(() => rows.filter((row) => row.estado === config.activeState).map((row) => {
    const person = mode === "esfob" ? findFriend(row.amigo_id) : findName(row.persona_id);
    const dias = diasDesde(row.fecha_inicio);
    const listo = mode === "esfob"
      ? Number(row.lecciones_completadas || 0) >= Number(row.lecciones_total || 1)
      : (dias ?? 0) > umbral;
    return { ...row, person, dias, listo, zonaNombre: person?.zonas?.nombre || t("rutaFormacion.sinZona") };
  }), [rows, friends, people, mode, umbral]);
  const candidatos = filas.filter((row) => row.listo);
  const seleccionado = filas.find((row) => row.id === selectedId);
  const zonaRows = useMemo(() => {
    if (mode !== "esfob") return [];
    const conteo = new Map();
    filas.forEach((row) => conteo.set(row.zonaNombre, (conteo.get(row.zonaNombre) || 0) + 1));
    return [...conteo.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);
  }, [filas, mode]);
  const promedioDias = filas.length ? Math.round(filas.reduce((sum, row) => sum + (row.dias || 0), 0) / filas.length) : 0;
  const insight = candidatos.length
    ? mode === "esfob"
      ? t("rutaFormacion.insightEsfobListos", { count: candidatos.length })
      : t("rutaFormacion.insightDiscipuladoUmbral", { count: candidatos.length, umbral })
    : filas.length
      ? t("rutaFormacion.insightActivosPromedio", { count: filas.length, promedio: promedioDias })
      : t("rutaFormacion.insightSinProcesos");

  function exportResumen() {
    const kpis = [
      { label: config.activeLabel, value: active },
      { label: t("rutaFormacion.completados"), value: completed },
      { label: mode === "esfob" ? t("rutaFormacion.candidatosATrasladar") : t("rutaFormacion.requierenSeguimiento"), value: candidatos.length },
    ];
    if (mode === "discipulado") kpis.push({ label: t("rutaFormacion.tasaDeExito"), value: discipuladoStats.tasaExito === null ? t("rutaFormacion.sinDatos") : `${discipuladoStats.tasaExito}%` });
    return {
      kpis,
      desgloses: mode === "esfob" ? [{ titulo: t("rutaFormacion.personasEsfobPorZona"), items: zonaRows.map((row) => ({ label: row.nombre, valor: row.total })) }] : [],
    };
  }
  function exportHeaders() {
    return {
      headers: [t("rutaFormacion.colPersona"), mode === "esfob" ? t("rutaFormacion.colZona") : t("rutaFormacion.colEstado"), t("rutaFormacion.colDias"), mode === "esfob" ? t("rutaFormacion.colResponsable") : t("rutaFormacion.colMentor")],
      rows: filas.map((row) => {
        const responsible = findName(row.responsable_persona_id || row.mentor_persona_id);
        const responsableTexto = row.responsable_comite ? t("rutaFormacion.comiteNombre", { nombre: row.responsable_comite.nombre }) : responsible ? `${responsible.nombres} ${responsible.apellidos}` : t("rutaFormacion.sinAsignar");
        const nombrePersona = row.person ? `${row.person.nombres || ""} ${row.person.apellidos || ""}`.trim() : "—";
        return [nombrePersona, mode === "esfob" ? row.zonaNombre : (ESTADOS_DISCIPULADO[row.estado] || row.estado), row.dias ?? 0, responsableTexto];
      }),
    };
  }
  const exportTitulo = t("rutaFormacion.exportTitulo", { titulo: config.title });
  function exportCsv() { descargarCsv({ filename: `${mode}-${hoyBogota()}.csv`, titulo: exportTitulo, ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `${mode}-${hoyBogota()}.xlsx`, hoja: config.title, titulo: exportTitulo, resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `${mode}-${hoyBogota()}.pdf`, titulo: exportTitulo, orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

  // Analitica de Discipulado: tendencia de inicios, distribucion por
  // estado y tasa de exito -- calculadas sobre `rows`, que ya trae TODO
  // el historico (no solo los activos), sin necesidad de otra consulta.
  const discipuladoStats = useMemo(() => {
    if (mode !== "discipulado") return null;
    const porMes = new Map();
    rows.forEach((row) => {
      const clave = row.fecha_inicio?.slice(0, 7);
      if (clave) porMes.set(clave, (porMes.get(clave) || 0) + 1);
    });
    const meses = [...porMes.keys()].sort();
    const trend = trendDataset(
      meses.map((mes) => new Date(`${mes}-01T00:00:00`).toLocaleDateString(i18n.language === "en" ? "en-US" : i18n.language === "pt" ? "pt-BR" : "es-CO", { month: "short", year: "2-digit" })),
      meses.map((mes) => porMes.get(mes)),
      { label: t("rutaFormacion.discipuladosIniciadosPorMes") }
    );
    const distribucion = distributionDataset(
      Object.entries(ESTADOS_DISCIPULADO).map(([key, label]) => ({ label, total: rows.filter((row) => row.estado === key).length })).filter((item) => item.total > 0),
      { datasetLabel: t("rutaFormacion.personasAcompanadas") }
    );
    const finalizados = rows.filter((row) => row.estado === "completado" || row.estado === "retirado");
    const tasaExito = finalizados.length ? Math.round((rows.filter((row) => row.estado === "completado").length / finalizados.length) * 100) : null;
    return { meses, trend, distribucion, tasaExito };
  }, [rows, mode]);
  const insightLecciones = mode === "discipulado" && lecciones.length
    ? t("rutaFormacion.insightCurriculo", { count: lecciones.length, completadas: totalLessons, sufijoCompletadas: totalLessons === 1 ? t("rutaFormacion.completadaSingular") : t("rutaFormacion.completadaPlural") })
    : null;

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t("rutaFormacion.cargando", { titulo: config.title })}</div>;

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to="/misiones-evangelismo" className="btn-secondary mb-4"><ArrowLeft className="w-4 h-4" />{t("rutaFormacion.volverMisiones")}</Link>
          <p className="eyebrow">{config.eyebrow}</p>
          <h1 className="section-title">{config.title}</h1>
          <p className="text-sm text-secondary mt-1">{config.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
          {canEdit && <button type="button" className="btn-primary" onClick={() => setShowForm((current) => !current)}><Plus className="w-4 h-4" />{showForm ? t("rutaFormacion.cerrarRegistro") : t("rutaFormacion.iniciarProceso")}</button>}
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      <Toast>{notice}</Toast>
      {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">{t("rutaFormacion.soloConsulta")}</p>}
      {showForm && <form onSubmit={createProcess} className="card p-5 grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><p className="eyebrow">{t("rutaFormacion.nuevoProceso")}</p><h2 className="font-medium mt-1">{t("rutaFormacion.registrarTitulo", { titulo: config.title })}</h2></div>
        <label className="text-sm text-secondary">{mode === "esfob" ? t("rutaFormacion.amigoEnRuta") : t("rutaFormacion.personaBautizada")}<select className="input-field mt-1" value={form.subjectId} onChange={(event) => {
          const subjectId = event.target.value;
          const amigoElegido = mode === "esfob" ? friends.find((item) => item.id === subjectId) : null;
          setForm({ ...form, subjectId, responsibleId: amigoElegido?.comite_origen_id || form.responsibleId });
        }} required><option value="">{t("rutaFormacion.seleccionaPersona")}</option>{(mode === "esfob" ? friends : people).map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos || ""}</option>)}</select></label>
        <label className="text-sm text-secondary flex items-center gap-1">{mode === "esfob" ? t("rutaFormacion.comiteResponsable") : t("rutaFormacion.comiteMentor")}<InfoTip texto={t("rutaFormacion.comiteTip", { titulo: config.title })} /><select required className="input-field mt-1 w-full" value={form.responsibleId} onChange={(event) => updateForm("responsibleId", event.target.value)}><option value="">{t("rutaFormacion.seleccionaComite")}</option>{comites.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label className="text-sm text-secondary">{t("rutaFormacion.programa")}<input className="input-field mt-1" value={form.program} onChange={(event) => updateForm("program", event.target.value)} required /></label>
        <label className="text-sm text-secondary">{t("rutaFormacion.fechaInicio")}<input type="date" className="input-field mt-1" value={form.date} onChange={(event) => updateForm("date", event.target.value)} required /></label>
        {mode === "discipulado" && <label className="text-sm text-secondary">{t("rutaFormacion.servicioActual")}<input className="input-field mt-1" value={form.service} onChange={(event) => updateForm("service", event.target.value)} placeholder={t("rutaFormacion.servicioActualPlaceholder")} /></label>}
        <p className="text-sm text-secondary md:col-span-2 bg-surface-1 rounded p-3">
          {lecciones.length
            ? t("rutaFormacion.empezaraEnLeccion", { titulo: lecciones[0].titulo, total: lecciones.length })
            : t("rutaFormacion.sinCatalogoLecciones", { titulo: config.title })}
        </p>
        <label className="text-sm text-secondary md:col-span-2">{t("rutaFormacion.notas")}<textarea className="input-field mt-1 min-h-20" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} /></label>
        <div className="md:col-span-2 flex justify-end"><button className="btn-primary" type="submit" disabled={saving}>{saving ? t("rutaFormacion.guardando") : t("rutaFormacion.guardarProceso")}</button></div>
      </form>}
      <section className={mode === "discipulado" ? "grid sm:grid-cols-3 lg:grid-cols-6 gap-3" : "grid sm:grid-cols-4 gap-3"}>
        <Metric label={config.activeLabel} value={active} />
        <Metric label={t("rutaFormacion.completados")} value={completed} tone={completed ? "text-success" : ""} />
        {mode === "discipulado" && <Metric label={t("rutaFormacion.personasAcompanadas")} value={rows.length} />}
        <Metric label={t("rutaFormacion.leccionesCompletadas")} value={totalLessons} />
        <Metric label={mode === "esfob" ? t("rutaFormacion.candidatosATrasladar") : t("rutaFormacion.requierenSeguimiento")} value={candidatos.length} tone={candidatos.length ? "text-warning" : ""} tip={mode === "esfob" ? t("rutaFormacion.esfobCandidatosTip") : t("rutaFormacion.discipuladoCandidatosTip", { umbral })} />
        {mode === "discipulado" && <Metric label={t("rutaFormacion.tasaDeExito")} value={discipuladoStats.tasaExito === null ? "—" : `${discipuladoStats.tasaExito}%`} tone={discipuladoStats.tasaExito === null ? "" : discipuladoStats.tasaExito < 70 ? "text-danger" : "text-success"} tip={t("rutaFormacion.tasaExitoTip")} />}
      </section>
      <p className={`text-sm rounded p-3 ${candidatos.length ? "text-warning bg-warning-bg" : "text-secondary bg-surface-1"}`}>{insight}</p>
      {insightLecciones && <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightLecciones}</p>}
      {mode === "esfob" && <section className="card chart-card p-5">
        <p className="eyebrow">{t("rutaFormacion.coberturaTerritorial")}</p>
        <h2 className="font-medium mt-1">{t("rutaFormacion.personasEsfobPorZona")}</h2>
        <div className="h-56 mt-4">{zonaRows.length ? <Bar data={distributionDataset(zonaRows, { labelKey: "nombre", valueKey: "total", datasetLabel: t("rutaFormacion.personasAcompanadas") })} options={CHART_OPTIONS} /> : <ChartEmpty message={t("rutaFormacion.sinDatosSuficientes")} />}</div>
      </section>}
      {mode === "discipulado" && <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("rutaFormacion.historial")}</p>
          <h2 className="font-medium mt-1">{t("rutaFormacion.discipuladosIniciadosPorMes")}</h2>
          <div className="h-56 mt-4">{discipuladoStats.meses.length ? <Line data={discipuladoStats.trend} options={CHART_OPTIONS} /> : <ChartEmpty message={t("rutaFormacion.sinProcesosRegistrados")} />}</div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("rutaFormacion.estadoActual")}</p>
          <h2 className="font-medium mt-1">{t("rutaFormacion.personasPorEstado")}</h2>
          <div className="h-56 mt-4">{discipuladoStats.distribucion.labels.length ? <Bar data={discipuladoStats.distribucion} options={CHART_OPTIONS} /> : <ChartEmpty message={t("rutaFormacion.sinProcesosRegistrados")} />}</div>
        </div>
      </section>}
      <section className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
          <div className="card p-5">
            <div className="flex items-start gap-3 pb-4 border-b border-border"><span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center"><BookOpen className="w-4 h-4" /></span><div><p className="eyebrow">{t("rutaFormacion.seguimientoOperativo")}</p><h2 className="font-medium mt-1 flex items-center gap-1.5">{t("rutaFormacion.procesosActivos")}<InfoTip texto={mode === "esfob" ? t("rutaFormacion.procesosActivosTipEsfob") : t("rutaFormacion.procesosActivosTipDiscipulado")} /></h2></div></div>
            {filas.length === 0 ? <p className="text-sm text-secondary py-6">{t("rutaFormacion.sinProcesosActivos")}</p> : <div className="divide-y divide-border">{filas.map((row) => { const responsible = findName(row.responsable_persona_id || row.mentor_persona_id); const responsibleComite = row.responsable_comite; return (
              <button key={row.id} type="button" onClick={() => seleccionarFicha(row)} className={`w-full text-left py-4 flex flex-col gap-1 ${selectedId === row.id ? "bg-accent-bg/40 -mx-5 px-5" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{row.person?.nombres} {row.person?.apellidos || ""}</p>
                  {row.listo && <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded-full bg-warning-bg text-warning whitespace-nowrap">{mode === "esfob" ? t("rutaFormacion.listoParaTrasladar") : t("rutaFormacion.revisarContinuidad")}</span>}
                </div>
                <p className="text-xs text-secondary">{row.programa} · {t("rutaFormacion.colDias")}: {row.dias ?? 0}{responsibleComite ? ` · ${mode === "esfob" ? t("rutaFormacion.colResponsable") : t("rutaFormacion.colMentor")}: ${t("rutaFormacion.comiteNombre", { nombre: responsibleComite.nombre })}` : responsible ? ` · ${mode === "esfob" ? t("rutaFormacion.colResponsable") : t("rutaFormacion.colMentor")}: ${responsible.nombres} ${responsible.apellidos}` : ""}</p>
                <p className="text-xs text-secondary">{row.leccion_actual ? t("rutaFormacion.leccionNumeroTitulo", { numero: row.leccion_actual.numero, titulo: row.leccion_actual.titulo }) : lecciones.length ? t("rutaFormacion.sinLeccionAsignadaCorta") : t("rutaFormacion.sinCatalogoLeccionesCorta")} · {t("rutaFormacion.completadaCount", { count: row.lecciones_completadas || 0 })}</p>
              </button>
            ); })}</div>}
          </div>
          <div className="card p-5">
            {selectedId && seleccionado ? (
              <>
                <p className="eyebrow">{t("rutaFormacion.fichaDeSeguimiento")}</p>
                <h2 className="font-medium mt-1">{seleccionado.person?.nombres} {seleccionado.person?.apellidos || ""}</h2>
                <div className="mt-3 p-3 bg-surface-1 rounded">
                  {seleccionado.leccion_actual_id ? (
                    <>
                      <p className="text-sm font-medium">{t("rutaFormacion.leccionNumeroTitulo", { numero: seleccionado.leccion_actual?.numero, titulo: seleccionado.leccion_actual?.titulo })}</p>
                      <p className="text-xs text-secondary mt-1">{t("rutaFormacion.completadaCount", { count: seleccionado.lecciones_completadas || 0 })}</p>
                      {canEdit && <button type="button" onClick={() => marcarLeccion(seleccionado)} disabled={saving} className="btn-secondary px-2 py-1 text-xs mt-2">{t("rutaFormacion.marcarLeccionCompletada")}</button>}
                    </>
                  ) : lecciones.length ? (
                    <>
                      <p className="text-sm font-medium">{t("rutaFormacion.sinLeccionAsignada")}</p>
                      <p className="text-xs text-secondary mt-1">{t("rutaFormacion.leccionesCompletadasAntes", { count: seleccionado.lecciones_completadas || 0 })}</p>
                      {canEdit && <div className="flex items-center gap-2 mt-2">
                        <select aria-label={t("rutaFormacion.asignarLeccionLabel")} className="input-field text-xs flex-1" value={leccionParaAsignar} onChange={(event) => setLeccionParaAsignar(event.target.value)}>
                          <option value="">{t("rutaFormacion.seleccionaLeccion")}</option>
                          {lecciones.map((item) => <option key={item.id} value={item.id}>{t("rutaFormacion.opcionLeccion", { numero: item.numero, titulo: item.titulo })}</option>)}
                        </select>
                        <button type="button" onClick={() => asignarLeccion(seleccionado, leccionParaAsignar)} disabled={saving || !leccionParaAsignar} className="btn-primary px-3 text-xs whitespace-nowrap">{t("rutaFormacion.asignar")}</button>
                      </div>}
                    </>
                  ) : (
                    <p className="text-sm text-secondary">{t("rutaFormacion.sinCatalogoCrealo")}</p>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2">{t("rutaFormacion.historialLecciones")}</p>
                  {progreso.length ? <ul className="flex flex-col gap-1.5">{progreso.map((item) => <li key={item.id} className="text-xs text-secondary">{t("rutaFormacion.opcionLeccion", { numero: item.leccion?.numero, titulo: item.leccion?.titulo })} <span className="text-muted">· {item.fecha_completada}</span></li>)}</ul> : <p className="text-xs text-muted">{t("rutaFormacion.sinLeccionesCompletadas")}</p>}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2 flex items-center gap-1">{t("rutaFormacion.bitacoraLeccionActual")}<InfoTip texto={t("rutaFormacion.bitacoraTip")} /></p>
                  {canEdit && (seleccionado.leccion_actual_id ? (
                    <form onSubmit={agregarNota} className="flex flex-col gap-2 mb-3">
                      <textarea className="input-field text-sm min-h-16" placeholder={t("rutaFormacion.notaPlaceholder")} value={nuevaNota} onChange={(event) => setNuevaNota(event.target.value)} />
                      <div className="flex items-center gap-2">
                        <select aria-label={t("rutaFormacion.quienAnota")} className="input-field text-xs flex-1" value={nuevaNotaResponsable} onChange={(event) => setNuevaNotaResponsable(event.target.value)}>
                          <option value="">{t("rutaFormacion.sinAutor")}</option>
                          {people.map((person) => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos}</option>)}
                        </select>
                        <button type="submit" disabled={saving || !nuevaNota.trim()} className="btn-secondary px-3 text-xs whitespace-nowrap">{t("rutaFormacion.agregarNota")}</button>
                      </div>
                    </form>
                  ) : <p className="text-xs text-muted mb-3">{t("rutaFormacion.asignaLeccionParaAnotar")}</p>)}
                  {notasLeccion.length ? <ul className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">{notasLeccion.map((item) => (
                    <li key={item.id} className="text-xs bg-surface-1 rounded p-2.5">
                      <p className="text-secondary">{item.nota}</p>
                      <p className="text-muted mt-1">{t("rutaFormacion.opcionLeccion", { numero: item.leccion?.numero, titulo: item.leccion?.titulo })} · {item.responsable ? `${item.responsable.nombres} ${item.responsable.apellidos}` : t("rutaFormacion.sinAutor")} · {new Date(item.created_at).toLocaleDateString(i18n.language === "en" ? "en-US" : i18n.language === "pt" ? "pt-BR" : "es-CO")}</p>
                    </li>
                  ))}</ul> : <p className="text-xs text-muted">{t("rutaFormacion.sinNotasRegistradas")}</p>}
                </div>
                {mode === "esfob" ? (
                  canEdit && <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                    {seleccionado.listo && <div className="flex items-center gap-1.5"><button type="button" onClick={() => marcarBautizado(seleccionado)} disabled={saving} className="btn-primary justify-center flex-1">{t("rutaFormacion.marcarBautizado")}</button><InfoTip texto={t("rutaFormacion.marcarBautizadoTip")} /></div>}
                    <div className="flex flex-wrap items-center gap-2">
                      <select aria-label={t("rutaFormacion.trasladarA")} className="input-field text-xs flex-1" value={trasladoDestino[seleccionado.id] || ""} onChange={(event) => setTrasladoDestino({ ...trasladoDestino, [seleccionado.id]: event.target.value })}><option value="">{t("rutaFormacion.trasladarA")}</option>{estaciones.filter((item) => item.codigo !== mode && item.codigo !== "metodos" && DETALLE_ESTACION[item.codigo]?.requiere !== "persona").map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
                      <select aria-label={t("rutaFormacion.reasignarComiteOpcional")} title={t("rutaFormacion.reasignarComiteOpcional")} className="input-field text-xs w-40" value={trasladoComite[seleccionado.id] || ""} onChange={(event) => setTrasladoComite({ ...trasladoComite, [seleccionado.id]: event.target.value })}><option value="">{t("rutaFormacion.mantenerResponsable")}</option>{comites.map((item) => <option key={item.id} value={item.id}>{t("rutaFormacion.comiteNombre", { nombre: item.nombre })}</option>)}</select>
                      <button type="button" aria-label={t("rutaFormacion.confirmarTraslado")} onClick={() => trasladar(seleccionado)} disabled={saving} className="btn-secondary px-3"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
                      <button type="button" aria-label={t("rutaFormacion.reasignarComiteSinCambiarEstacion")} title={t("rutaFormacion.reasignarComiteSinCambiarEstacion")} onClick={() => reasignarComite(seleccionado)} disabled={saving || !trasladoComite[seleccionado.id]} className="btn-secondary px-2 text-xs whitespace-nowrap">{t("rutaFormacion.reasignarComite")}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <form onSubmit={guardarSeguimiento} className="grid gap-3 mt-4 pt-4 border-t border-border">
                      <label className="text-sm">{t("rutaFormacion.servicioActual")}<input disabled={!canEdit} className="input-field mt-1.5" placeholder={t("rutaFormacion.servicioActualPlaceholder")} value={seguimientoForm.servicio_actual} onChange={(event) => setSeguimientoForm({ ...seguimientoForm, servicio_actual: event.target.value })} /></label>
                      <label className="text-sm">{t("rutaFormacion.proximaAccion")}<input disabled={!canEdit} className="input-field mt-1.5" placeholder={t("rutaFormacion.proximaAccionPlaceholder")} value={seguimientoForm.siguiente_accion} onChange={(event) => setSeguimientoForm({ ...seguimientoForm, siguiente_accion: event.target.value })} /></label>
                      <label className="text-sm flex items-center gap-1">{t("rutaFormacion.notasGenerales")}<InfoTip texto={t("rutaFormacion.notasGeneralesTip")} /><textarea disabled={!canEdit} className="input-field mt-1.5 min-h-20 w-full" value={seguimientoForm.notas} onChange={(event) => setSeguimientoForm({ ...seguimientoForm, notas: event.target.value })} /></label>
                      {canEdit && <button disabled={saving} className="btn-primary justify-center">{saving ? t("rutaFormacion.guardando") : t("rutaFormacion.guardarSeguimiento")}</button>}
                    </form>
                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
                        <select aria-label={t("rutaFormacion.comiteDeSeguimiento")} className="input-field text-xs w-40" value={trasladoComite[seleccionado.id] || ""} onChange={(event) => setTrasladoComite({ ...trasladoComite, [seleccionado.id]: event.target.value })}><option value="">{t("rutaFormacion.comiteDeSeguimiento")}</option>{comites.map((item) => <option key={item.id} value={item.id}>{t("rutaFormacion.comiteNombre", { nombre: item.nombre })}</option>)}</select>
                        <button type="button" title={t("rutaFormacion.reasignarComiteSinSalirDiscipulado")} onClick={() => reasignarComite(seleccionado)} disabled={saving || !trasladoComite[seleccionado.id]} className="btn-secondary px-3 text-xs whitespace-nowrap">{t("rutaFormacion.reasignarComite")}</button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : <div className="card h-48 flex items-center justify-center text-sm text-muted">{t("rutaFormacion.seleccionaPersonaLista")}</div>}
          </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "text-ink", tip }) {
  return <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">{label}{tip && <InfoTip texto={tip} />}</p><p className={`text-2xl font-semibold mt-3 ${tone}`}>{value}</p></div>;
}
