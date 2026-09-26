import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { ArrowLeft, ArrowRightLeft, HeartHandshake, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { hoyBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, distributionDataset } from "../lib/chartTheme";
import { DETALLE_ESTACION, UMBRAL_DIAS_ESTACION, diasDesde, getComitesActivos, getEstacion, getEstacionActivos, iniciarOMoverEstacion, reasignarComiteResponsable, trasladarEstacion } from "../lib/rutaEvangelistica";
import InfoTip from "../components/InfoTip";
import ExportButtons from "../components/ExportButtons";
import Toast from "../components/Toast";
import { descargarCsv, descargarExcel, descargarPdf } from "../lib/reportExport";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);
const estacionRefamCache = new Map();
const CHART_OPTIONS = chartOptions();
const UMBRAL = UMBRAL_DIAS_ESTACION.refam;

export default function EstacionRefam() {
  const { t, i18n } = useTranslation();
  const REFAM_ESTADO_LABELS = t("estacionRefam.estados", { returnObjects: true });
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [estacion, setEstacion] = useState(null);
  const [estaciones, setEstaciones] = useState([]);
  const [activos, setActivos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [amigosDisponibles, setAmigosDisponibles] = useState([]);
  const [refamGrupos, setRefamGrupos] = useState([]);
  const [refamLecciones, setRefamLecciones] = useState([]);
  const [refamGrupoForm, setRefamGrupoForm] = useState({ nombre: "", zona_id: "", anfitrion_persona_id: "", lider_persona_id: "", direccion: "", dia_reunion: "" });
  const [selectedRefamGrupoId, setSelectedRefamGrupoId] = useState(null);
  const [refamParticipantes, setRefamParticipantes] = useState([]);
  const [refamReuniones, setRefamReuniones] = useState([]);
  const [asistenciaPorParticipante, setAsistenciaPorParticipante] = useState({});
  const [progresoPorParticipante, setProgresoPorParticipante] = useState({});
  const [refamParticipanteForm, setRefamParticipanteForm] = useState({ tipo: "amigo", sujeto_id: "", comiteId: "" });
  const [comites, setComites] = useState([]);
  const [trasladoComite, setTrasladoComite] = useState({});
  const [refamReunionForm, setRefamReunionForm] = useState({ fecha: hoyBogota(), numero_leccion: "", tema: "", asistentes: "", visitantes: "", resultado: "", novedades: "" });
  const [asistenciaRefamMarcada, setAsistenciaRefamMarcada] = useState({});
  const [notasAbiertasParticipanteId, setNotasAbiertasParticipanteId] = useState(null);
  const [notasPorParticipante, setNotasPorParticipante] = useState({});
  const [nuevaNotaRefam, setNuevaNotaRefam] = useState("");
  const [nuevaNotaRefamResponsable, setNuevaNotaRefamResponsable] = useState("");
  const [trasladoDestino, setTrasladoDestino] = useState({});
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(null); // null = todavia no se confirma el permiso
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function load() {
    if (!congregacionId) { setLoading(false); return; }
    const cacheKey = congregacionId;
    const cached = estacionRefamCache.get(cacheKey);
    if (cached) {
      setEstacion(cached.estacion);
      setActivos(cached.activos);
      setZonas(cached.zonas);
      setPersonas(cached.personas);
      setAmigosDisponibles(cached.amigosDisponibles);
      setRefamGrupos(cached.refamGrupos);
      setEstaciones(cached.estaciones);
      setRefamLecciones(cached.refamLecciones);
      setComites(cached.comites);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const estacionResult = await getEstacion(congregacionId, "refam");
    if (estacionResult.error || !estacionResult.data) { setError(t("estacionRefam.errorEstacionNoEncontrada")); setLoading(false); return; }
    const [activosResult, zonasResult, personasResult, amigosResult, gruposResult, estacionesResult, leccionesResult, comitesResult] = await Promise.all([
      getEstacionActivos(congregacionId, estacionResult.data.id),
      supabase.from("zonas").select("id, nombre").eq("congregacion_id", congregacionId).order("nombre"),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("amigos").select("id, nombres, zona_id, comite_origen_id, zonas(nombre)").eq("congregacion_id", congregacionId).eq("convertido", false).order("nombres"),
      supabase.from("refam_grupos").select("id, nombre, direccion, dia_reunion, activo, zona_id, anfitrion_persona_id, lider_persona_id, zonas(nombre), anfitrion:anfitrion_persona_id(nombres, apellidos), lider:lider_persona_id(nombres, apellidos)").eq("congregacion_id", congregacionId).order("nombre"),
      supabase.from("ruta_estaciones").select("id, codigo, nombre, orden").eq("congregacion_id", congregacionId).order("orden"),
      supabase.from("refam_lecciones").select("id, numero, titulo, descripcion").eq("congregacion_id", congregacionId).eq("activo", true).order("numero"),
      getComitesActivos(congregacionId),
    ]);
    if (activosResult.error || zonasResult.error || personasResult.error || amigosResult.error || gruposResult.error) { setError(t("estacionRefam.errorCargarEstacion")); setLoading(false); return; }
    const freshData = {
      estacion: estacionResult.data,
      activos: activosResult.data ?? [],
      zonas: zonasResult.data ?? [],
      personas: personasResult.data ?? [],
      amigosDisponibles: amigosResult.data ?? [],
      refamGrupos: gruposResult.data ?? [],
      estaciones: estacionesResult.data ?? [],
      refamLecciones: leccionesResult.data ?? [],
      comites: comitesResult.data ?? [],
    };
    setEstacion(freshData.estacion);
    setActivos(freshData.activos);
    setZonas(freshData.zonas);
    setPersonas(freshData.personas);
    setAmigosDisponibles(freshData.amigosDisponibles);
    setRefamGrupos(freshData.refamGrupos);
    setEstaciones(freshData.estaciones);
    setRefamLecciones(freshData.refamLecciones);
    setComites(freshData.comites);
    setLoading(false);
    estacionRefamCache.set(cacheKey, freshData);
  }

  useEffect(() => { load(); }, [congregacionId]);

  useEffect(() => {
    if (!congregacionId) return;
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "ruta_evangelistica.editar" }).then(({ data }) => {
      setCanEdit((rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura") || Boolean(data));
    });
  }, [congregacionId, rolPrincipal]);

  const filas = useMemo(() => activos.map((row) => ({
    ...row,
    dias: diasDesde(row.fecha_inicio),
    nombre: row.amigos?.nombres || (row.persona ? `${row.persona.nombres} ${row.persona.apellidos || ""}` : t("estacionRefam.sinNombre")),
    zonaNombre: row.amigos?.zonas?.nombre || t("estacionRefam.sinZona"),
  })), [activos, t]);
  const candidatos = filas.filter((row) => (row.dias ?? 0) > UMBRAL);
  const zonaRows = useMemo(() => {
    const conteo = new Map();
    filas.forEach((row) => conteo.set(row.zonaNombre, (conteo.get(row.zonaNombre) || 0) + 1));
    return [...conteo.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);
  }, [filas]);
  const promedioDias = filas.length ? Math.round(filas.reduce((sum, row) => sum + (row.dias || 0), 0) / filas.length) : 0;
  const insight = candidatos.length
    ? t("estacionRefam.insightCandidatos", { count: candidatos.length, umbral: UMBRAL })
    : filas.length
      ? t("estacionRefam.insightActivos", { count: filas.length, promedio: promedioDias })
      : t("estacionRefam.insightVacio");

  function exportResumen() {
    return {
      kpis: [
        { label: t("estacionRefam.statActivos"), value: filas.length },
        { label: t("estacionRefam.statCandidatos"), value: candidatos.length },
        { label: t("estacionRefam.statPromedioDias"), value: promedioDias },
      ],
      desgloses: [{ titulo: t("estacionRefam.desgloseTitulo"), items: zonaRows.map((row) => ({ label: row.nombre, valor: row.total })) }],
    };
  }
  function exportHeaders() {
    return {
      headers: [t("estacionRefam.headerPersona"), t("estacionRefam.headerZona"), t("estacionRefam.headerDiasRefam"), t("estacionRefam.headerResponsable"), t("estacionRefam.headerComite")],
      rows: filas.map((row) => [row.nombre, row.zonaNombre, row.dias ?? 0, row.responsable ? `${row.responsable.nombres} ${row.responsable.apellidos}` : t("estacionRefam.sinAsignar"), row.responsable_comite?.nombre || "—"]),
    };
  }
  function exportCsv() { descargarCsv({ filename: `refam-${hoyBogota()}.csv`, titulo: t("estacionRefam.exportTitulo"), ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `refam-${hoyBogota()}.xlsx`, hoja: "REFAM", titulo: t("estacionRefam.exportTitulo"), resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `refam-${hoyBogota()}.pdf`, titulo: t("estacionRefam.exportTitulo"), orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

  async function createRefamGrupo(event) {
    event.preventDefault();
    if (!canEdit || !refamGrupoForm.nombre.trim()) return;
    setError(null);
    const result = await supabase.from("refam_grupos").insert({
      congregacion_id: congregacionId,
      nombre: refamGrupoForm.nombre.trim(),
      zona_id: refamGrupoForm.zona_id || null,
      anfitrion_persona_id: refamGrupoForm.anfitrion_persona_id || null,
      lider_persona_id: refamGrupoForm.lider_persona_id || null,
      direccion: refamGrupoForm.direccion.trim() || null,
      dia_reunion: refamGrupoForm.dia_reunion.trim() || null,
    });
    if (result.error) { setError(t("estacionRefam.errorCrearGrupo", { mensaje: result.error.message })); return; }
    setNotice(t("estacionRefam.noticeGrupoCreado"));
    setRefamGrupoForm({ nombre: "", zona_id: "", anfitrion_persona_id: "", lider_persona_id: "", direccion: "", dia_reunion: "" });
    load();
  }

  async function loadRefamGrupoDetail(grupoId) {
    setSelectedRefamGrupoId(grupoId);
    setRefamParticipantes([]);
    setRefamReuniones([]);
    if (!grupoId) return;
    const [participantesResult, reunionesResult] = await Promise.all([
      supabase.from("refam_participantes").select("id, amigo_id, persona_id, fecha_ingreso, estado, leccion_actual_id, amigos:amigo_id(nombres), personas:persona_id(nombres, apellidos), leccion_actual:refam_lecciones(numero, titulo)").eq("grupo_id", grupoId).order("fecha_ingreso", { ascending: false }),
      supabase.from("refam_reuniones").select("id, fecha, numero_leccion, tema, asistentes, visitantes, resultado, novedades").eq("grupo_id", grupoId).order("fecha", { ascending: false }),
    ]);
    if (participantesResult.error || reunionesResult.error) { setError(t("estacionRefam.errorCargarDetalleGrupo")); return; }
    const participantes = participantesResult.data ?? [];
    setRefamParticipantes(participantes);
    setRefamReuniones(reunionesResult.data ?? []);
    setAsistenciaRefamMarcada(Object.fromEntries(participantes.map((item) => [item.id, true])));
    if (participantes.length) {
      const [asistenciaResult, progresoResult] = await Promise.all([
        supabase.from("refam_asistencia_participante").select("participante_id, asistio").in("participante_id", participantes.map((item) => item.id)).eq("asistio", true),
        supabase.from("refam_progreso_leccion").select("participante_id").in("participante_id", participantes.map((item) => item.id)),
      ]);
      if (asistenciaResult.error || progresoResult.error) { setError(t("estacionRefam.errorCargarAsistenciaProgreso")); return; }
      const conteo = {};
      (asistenciaResult.data ?? []).forEach((item) => { conteo[item.participante_id] = (conteo[item.participante_id] || 0) + 1; });
      setAsistenciaPorParticipante(conteo);
      const conteoProgreso = {};
      (progresoResult.data ?? []).forEach((item) => { conteoProgreso[item.participante_id] = (conteoProgreso[item.participante_id] || 0) + 1; });
      setProgresoPorParticipante(conteoProgreso);
    } else {
      setAsistenciaPorParticipante({});
      setProgresoPorParticipante({});
    }
  }

  async function marcarLeccionCompletada(participante) {
    if (!canEdit || !participante.leccion_actual_id) return;
    setSaving(true);
    setError(null);
    const grupo = refamGrupos.find((item) => item.id === selectedRefamGrupoId);
    const result = await supabase.from("refam_progreso_leccion").insert({
      participante_id: participante.id,
      leccion_id: participante.leccion_actual_id,
      responsable_persona_id: grupo?.lider_persona_id || null,
    });
    if (result.error) { setSaving(false); setError(t("estacionRefam.errorMarcarLeccion", { mensaje: result.error.message })); return; }
    const siguiente = refamLecciones.find((item) => item.numero === (participante.leccion_actual?.numero || 0) + 1);
    const updateResult = await supabase.from("refam_participantes").update({ leccion_actual_id: siguiente?.id || null }).eq("id", participante.id);
    setSaving(false);
    if (updateResult.error) { setError(t("estacionRefam.errorAvanzarLeccion", { mensaje: updateResult.error.message })); return; }
    setNotice(siguiente ? t("estacionRefam.noticeLeccionCompletadaAvanzo", { numero: siguiente.numero }) : t("estacionRefam.noticeLeccionCompletadaFin"));
    if (participante.id === notasAbiertasParticipanteId) refrescarNotasRefam(participante.id);
    loadRefamGrupoDetail(selectedRefamGrupoId);
  }

  async function refrescarNotasRefam(participanteId) {
    const { data, error: fetchError } = await supabase
      .from("refam_notas_leccion")
      .select("id, nota, created_at, leccion:refam_lecciones(numero, titulo), responsable:personas(nombres, apellidos)")
      .eq("participante_id", participanteId)
      .order("created_at", { ascending: false });
    if (fetchError) { setError(t("estacionRefam.errorCargarNotas")); return; }
    setNotasPorParticipante((current) => ({ ...current, [participanteId]: data ?? [] }));
  }

  function toggleNotasParticipante(participante) {
    if (notasAbiertasParticipanteId === participante.id) { setNotasAbiertasParticipanteId(null); return; }
    setNotasAbiertasParticipanteId(participante.id);
    setNuevaNotaRefam("");
    setNuevaNotaRefamResponsable("");
    refrescarNotasRefam(participante.id);
  }

  async function agregarNotaRefam(participante) {
    if (!canEdit || !nuevaNotaRefam.trim() || !participante.leccion_actual_id) return;
    setSaving(true);
    setError(null);
    const result = await supabase.from("refam_notas_leccion").insert({
      participante_id: participante.id,
      leccion_id: participante.leccion_actual_id,
      nota: nuevaNotaRefam.trim(),
      responsable_persona_id: nuevaNotaRefamResponsable || null,
    });
    setSaving(false);
    if (result.error) { setError(t("estacionRefam.errorGuardarNota", { mensaje: result.error.message })); return; }
    setNuevaNotaRefam("");
    refrescarNotasRefam(participante.id);
  }

  async function addRefamParticipante(event) {
    event.preventDefault();
    if (!canEdit || !selectedRefamGrupoId || !refamParticipanteForm.sujeto_id || !refamParticipanteForm.comiteId || !estacion) return;
    setError(null);
    setSaving(true);
    const payload = {
      congregacion_id: congregacionId,
      grupo_id: selectedRefamGrupoId,
      fecha_ingreso: hoyBogota(),
      amigo_id: refamParticipanteForm.tipo === "amigo" ? refamParticipanteForm.sujeto_id : null,
      persona_id: refamParticipanteForm.tipo === "persona" ? refamParticipanteForm.sujeto_id : null,
      leccion_actual_id: refamLecciones[0]?.id || null,
    };
    const result = await supabase.from("refam_participantes").insert(payload);
    if (result.error) { setSaving(false); setError(t("estacionRefam.errorAgregarParticipante", { mensaje: result.error.message })); return; }
    // Sincroniza con la ruta evangelistica -- sin esto, la persona queda en el
    // grupo REFAM pero el sistema (y funnel_refam en el BI distrital) no
    // refleja que esta activa en esta estacion.
    const rutaResult = await iniciarOMoverEstacion({
      congregacionId,
      estacionDestino: estacion,
      amigoId: payload.amigo_id,
      personaId: payload.persona_id,
      responsableComiteId: refamParticipanteForm.comiteId,
    });
    setSaving(false);
    if (rutaResult.error) { setError(t("estacionRefam.errorSincronizarRuta", { mensaje: rutaResult.error.message })); }
    else setNotice(t("estacionRefam.noticeParticipanteAgregado"));
    setRefamParticipanteForm({ tipo: "amigo", sujeto_id: "", comiteId: "" });
    loadRefamGrupoDetail(selectedRefamGrupoId);
    load();
  }

  async function addRefamReunion(event) {
    event.preventDefault();
    if (!canEdit || !selectedRefamGrupoId) return;
    setError(null);
    const result = await supabase.from("refam_reuniones").insert({
      congregacion_id: congregacionId,
      grupo_id: selectedRefamGrupoId,
      fecha: refamReunionForm.fecha,
      numero_leccion: Number(refamReunionForm.numero_leccion) || 1,
      tema: refamReunionForm.tema.trim() || null,
      asistentes: Number(refamReunionForm.asistentes) || 0,
      visitantes: Number(refamReunionForm.visitantes) || 0,
      resultado: refamReunionForm.resultado.trim() || null,
      novedades: refamReunionForm.novedades.trim() || null,
    }).select("id").single();
    if (result.error) { setError(t("estacionRefam.errorRegistrarReunion", { mensaje: result.error.message })); return; }
    if (refamParticipantes.length) {
      const asistenciaPayload = refamParticipantes.map((item) => ({
        reunion_id: result.data.id,
        participante_id: item.id,
        asistio: Boolean(asistenciaRefamMarcada[item.id]),
      }));
      const asistenciaResult = await supabase.from("refam_asistencia_participante").insert(asistenciaPayload);
      if (asistenciaResult.error) { setError(t("estacionRefam.errorAsistenciaIndividualReunion", { mensaje: asistenciaResult.error.message })); loadRefamGrupoDetail(selectedRefamGrupoId); return; }
    }
    setNotice(t("estacionRefam.noticeReunionRegistrada"));
    setRefamReunionForm({ fecha: hoyBogota(), numero_leccion: "", tema: "", asistentes: "", visitantes: "", resultado: "", novedades: "" });
    loadRefamGrupoDetail(selectedRefamGrupoId);
  }

  async function trasladar(proceso) {
    if (!canEdit) return;
    const destinoId = trasladoDestino[proceso.id];
    const destino = estaciones.find((item) => item.id === destinoId);
    if (!destino) { setError(t("estacionRefam.errorSeleccionaEstacion")); return; }
    setSaving(true);
    setError(null);
    const nuevoComiteId = trasladoComite[proceso.id];
    const result = await trasladarEstacion({
      congregacionId,
      estacionOrigenCodigo: "refam",
      estacionDestino: destino,
      amigoId: proceso.amigo_id,
      personaId: proceso.persona_id,
      responsablePersonaId: nuevoComiteId ? null : proceso.responsable_persona_id,
      responsableComiteId: nuevoComiteId || proceso.responsable_comite_id || null,
    });
    setSaving(false);
    if (result.error) { setError(t("estacionRefam.errorTrasladar", { mensaje: result.error.message })); return; }
    setNotice(t("estacionRefam.noticeTrasladado", { destino: destino.nombre }));
    load();
  }

  // Cambia el comite responsable sin trasladar de estacion -- ej. una
  // adolescente que cumple 18 años y pasa de Adolescentes a Jovenes,
  // sin dejar REFAM. Distinto de trasladar(), que siempre exige un
  // destino nuevo.
  async function reasignarComite(proceso) {
    if (!canEdit) return;
    const nuevoComiteId = trasladoComite[proceso.id];
    if (!nuevoComiteId) { setError(t("estacionRefam.errorSeleccionaComite")); return; }
    setSaving(true);
    setError(null);
    const result = await reasignarComiteResponsable({ procesoId: proceso.id, estacionCodigo: "refam", nuevoComiteId });
    setSaving(false);
    if (result.error) { setError(t("estacionRefam.errorReasignarComite", { mensaje: result.error.message })); return; }
    setNotice(t("estacionRefam.noticeComiteReasignado"));
    setTrasladoComite({ ...trasladoComite, [proceso.id]: "" });
    load();
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t("estacionRefam.cargando")}</div>;

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to="/misiones-evangelismo" className="btn-secondary mb-4"><ArrowLeft className="w-4 h-4" />{t("estacionRefam.volverMisiones")}</Link>
          <p className="eyebrow">{t("estacionRefam.eyebrowEstacion")}</p>
          <h1 className="section-title">{t("estacionRefam.titulo")}</h1>
          <p className="text-sm text-secondary mt-1">{estacion?.descripcion || t("estacionRefam.subtituloFallback")}</p>
        </div>
        <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      <Toast>{notice}</Toast>
      <section className="grid sm:grid-cols-3 gap-3">
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{t("estacionRefam.statActivos")}</p><p className="text-2xl font-semibold mt-3">{filas.length}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">{t("estacionRefam.statCandidatos")}<InfoTip texto={t("estacionRefam.infoCandidatos", { umbral: UMBRAL })} /></p><p className={`text-2xl font-semibold mt-3 ${candidatos.length ? "text-warning" : ""}`}>{candidatos.length}</p></div>
        <div className="stat-tile"><p className="text-[10px] uppercase tracking-[0.14em] text-secondary">{t("estacionRefam.statPromedioDias")}</p><p className="text-2xl font-semibold mt-3">{promedioDias}</p></div>
      </section>
      <p className={`text-sm rounded p-3 ${candidatos.length ? "text-warning bg-warning-bg" : "text-secondary bg-surface-1"}`}>{insight}</p>
      <section className="card chart-card p-5">
        <p className="eyebrow">{t("estacionRefam.eyebrowCobertura")}</p>
        <h2 className="font-medium mt-1">{t("estacionRefam.tituloPersonasPorZona")}</h2>
        <div className="h-56 mt-4">{zonaRows.length ? <Bar data={distributionDataset(zonaRows, { labelKey: "nombre", valueKey: "total", datasetLabel: t("estacionRefam.datasetPersonas") })} options={CHART_OPTIONS} /> : <p className="text-sm text-muted py-10 text-center">{t("estacionRefam.sinDatos")}</p>}</div>
      </section>
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-border"><div><p className="eyebrow">{t("estacionRefam.eyebrowTablero")}</p><h2 className="font-medium mt-1 flex items-center gap-1.5">{t("estacionRefam.tituloPersonasActivas")}<InfoTip texto={t("estacionRefam.infoPersonasActivas")} /></h2></div></div>
        {filas.length === 0 ? <p className="text-sm text-secondary py-6">{t("estacionRefam.sinPersonasEnEstacion")}</p> : <div className="divide-y divide-border">{filas.map((row) => (
          <div key={row.id} className="py-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-medium text-sm">{row.nombre}</p><p className="text-xs text-secondary mt-0.5">{row.zonaNombre} · {row.dias ?? 0} días{row.responsable_comite ? t("estacionRefam.responsableComiteTexto", { nombre: row.responsable_comite.nombre }) : row.responsable ? t("estacionRefam.responsablePersonaTexto", { nombre: `${row.responsable.nombres} ${row.responsable.apellidos}` }) : ""}</p></div>
              {(row.dias ?? 0) > UMBRAL && <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded-full bg-warning-bg text-warning whitespace-nowrap">{t("estacionRefam.listoParaTrasladar")}</span>}
            </div>
            {canEdit && <div className="flex flex-wrap items-center gap-2">
              <select aria-label={t("estacionRefam.ariaTrasladarA")} className="input-field text-xs flex-1" value={trasladoDestino[row.id] || ""} onChange={(event) => setTrasladoDestino({ ...trasladoDestino, [row.id]: event.target.value })}><option value="">{t("estacionRefam.opcionTrasladarA")}</option>{estaciones.filter((item) => item.codigo !== "refam" && item.codigo !== "metodos" && DETALLE_ESTACION[item.codigo]?.requiere !== (row.persona_id ? "amigo" : "persona")).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
              <select aria-label={t("estacionRefam.ariaReasignarComiteOpcional")} title={t("estacionRefam.ariaReasignarComiteOpcional")} className="input-field text-xs w-40" value={trasladoComite[row.id] || ""} onChange={(event) => setTrasladoComite({ ...trasladoComite, [row.id]: event.target.value })}><option value="">{t("estacionRefam.opcionMantenerResponsable")}</option>{comites.map((item) => <option key={item.id} value={item.id}>{t("estacionRefam.opcionComitePrefix", { nombre: item.nombre })}</option>)}</select>
              <button type="button" aria-label={t("estacionRefam.ariaConfirmarTraslado")} onClick={() => trasladar(row)} disabled={saving} className="btn-secondary px-3"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
              <button type="button" aria-label={t("estacionRefam.ariaReasignarComiteBoton")} title={t("estacionRefam.tituloReasignarComiteBoton")} onClick={() => reasignarComite(row)} disabled={saving || !trasladoComite[row.id]} className="btn-secondary px-2 text-xs whitespace-nowrap">{t("estacionRefam.botonReasignarComite")}</button>
            </div>}
          </div>
        ))}</div>}
      </section>
      <section className="card p-5">
        <div className="mb-4 flex items-start gap-3"><span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center flex-shrink-0"><HeartHandshake className="w-4 h-4" /></span><div><p className="eyebrow">{t("estacionRefam.eyebrowMetodologia")}</p><h2 className="font-medium mt-1">{t("estacionRefam.tituloGruposParticipantes")}</h2><p className="text-xs text-secondary mt-1">{t("estacionRefam.descripcionMetodologia")}</p></div></div>
        {canEdit && <form onSubmit={createRefamGrupo} className="grid md:grid-cols-3 gap-3 mb-5">
          <label className="text-sm">{t("estacionRefam.labelNombreGrupo")}<input required className="input-field mt-1.5" value={refamGrupoForm.nombre} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, nombre: event.target.value })} /></label>
          <label className="text-sm">{t("estacionRefam.labelZona")}<select className="input-field mt-1.5" value={refamGrupoForm.zona_id} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, zona_id: event.target.value })}><option value="">{t("estacionRefam.sinZona")}</option>{zonas.map((zona) => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}</select></label>
          <label className="text-sm">{t("estacionRefam.labelDiaReunion")}<input className="input-field mt-1.5" placeholder={t("estacionRefam.placeholderDiaReunion")} value={refamGrupoForm.dia_reunion} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, dia_reunion: event.target.value })} /></label>
          <label className="text-sm">{t("estacionRefam.labelAnfitrion")}<select className="input-field mt-1.5" value={refamGrupoForm.anfitrion_persona_id} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, anfitrion_persona_id: event.target.value })}><option value="">{t("estacionRefam.opcionSinAnfitrion")}</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
          <label className="text-sm">{t("estacionRefam.labelLider")}<select className="input-field mt-1.5" value={refamGrupoForm.lider_persona_id} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, lider_persona_id: event.target.value })}><option value="">{t("estacionRefam.opcionSinLider")}</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}</select></label>
          <label className="text-sm">{t("estacionRefam.labelDireccion")}<input className="input-field mt-1.5" value={refamGrupoForm.direccion} onChange={(event) => setRefamGrupoForm({ ...refamGrupoForm, direccion: event.target.value })} /></label>
          <div className="md:col-span-3 flex justify-end"><button className="btn-primary"><Plus className="w-4 h-4" />{t("estacionRefam.botonCrearGrupo")}</button></div>
        </form>}
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
          <div className="flex flex-col gap-2">{refamGrupos.map((grupo) => <button type="button" key={grupo.id} onClick={() => loadRefamGrupoDetail(grupo.id)} className={`text-left border rounded-card p-3 ${selectedRefamGrupoId === grupo.id ? "border-accent bg-accent-bg" : "border-border"}`}><p className="text-sm font-medium">{grupo.nombre}</p><p className="text-xs text-secondary mt-1">{grupo.zonas?.nombre || t("estacionRefam.sinZona")}{grupo.dia_reunion ? ` · ${grupo.dia_reunion}` : ""}</p>{grupo.lider && <p className="text-xs text-muted mt-1">{t("estacionRefam.liderPrefix", { nombre: `${grupo.lider.nombres} ${grupo.lider.apellidos}` })}</p>}</button>)}{refamGrupos.length === 0 && <p className="text-sm text-muted">{t("estacionRefam.sinGruposRefam")}</p>}</div>
          <div>
            {selectedRefamGrupoId ? <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">{t("estacionRefam.tituloParticipantes")}<InfoTip texto={t("estacionRefam.infoParticipantes")} /></h3>
                {canEdit && <form onSubmit={addRefamParticipante} className="grid sm:grid-cols-2 lg:grid-cols-[0.8fr_1fr_1fr_auto] gap-2 mb-2 items-end">
                  <label className="text-xs text-secondary flex items-center gap-1">{t("estacionRefam.labelTipoParticipante")}<InfoTip texto={t("estacionRefam.infoTipoParticipante")} /><select className="input-field mt-1 w-full" value={refamParticipanteForm.tipo} onChange={(event) => setRefamParticipanteForm({ ...refamParticipanteForm, tipo: event.target.value, sujeto_id: "" })}><option value="amigo">{t("estacionRefam.opcionAmigo")}</option><option value="persona">{t("estacionRefam.opcionPersona")}</option></select></label>
                  <label className="text-xs text-secondary">{t("estacionRefam.labelSujetoAAgregar", { tipo: refamParticipanteForm.tipo === "amigo" ? t("estacionRefam.opcionAmigo") : t("estacionRefam.opcionPersona") })}<select required className="input-field mt-1" value={refamParticipanteForm.sujeto_id} onChange={(event) => {
                    const sujetoId = event.target.value;
                    const amigoElegido = refamParticipanteForm.tipo === "amigo" ? amigosDisponibles.find((item) => item.id === sujetoId) : null;
                    setRefamParticipanteForm({ ...refamParticipanteForm, sujeto_id: sujetoId, comiteId: amigoElegido?.comite_origen_id || refamParticipanteForm.comiteId });
                  }}><option value="">{t("estacionRefam.opcionSelecciona")}</option>{(refamParticipanteForm.tipo === "amigo" ? amigosDisponibles : personas).map((item) => <option key={item.id} value={item.id}>{item.nombres} {item.apellidos || ""}</option>)}</select></label>
                  <label className="text-xs text-secondary flex items-center gap-1">{t("estacionRefam.labelComiteResponsable")}<InfoTip texto={t("estacionRefam.infoComiteResponsable")} /><select required className="input-field mt-1 w-full" value={refamParticipanteForm.comiteId} onChange={(event) => setRefamParticipanteForm({ ...refamParticipanteForm, comiteId: event.target.value })}><option value="">{t("estacionRefam.opcionSeleccionaComite")}</option>{comites.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
                  <button aria-label={t("estacionRefam.ariaAgregarParticipante")} disabled={saving} className="btn-secondary px-3"><Plus className="w-4 h-4" /></button>
                </form>}
                {refamParticipantes.length ? <div className="divide-y divide-border">{refamParticipantes.map((item) => <div key={item.id} className="py-2 text-sm flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate">{item.personas ? `${item.personas.nombres} ${item.personas.apellidos}` : item.amigos?.nombres || t("estacionRefam.sinNombre")} <span className="text-xs text-muted">· {REFAM_ESTADO_LABELS[item.estado] || item.estado}</span></p>
                      <p className="text-xs text-muted">{item.leccion_actual ? t("estacionRefam.leccionActualTexto", { numero: item.leccion_actual.numero, titulo: item.leccion_actual.titulo }) : refamLecciones.length ? t("estacionRefam.sinLeccionAsignada") : t("estacionRefam.sinCatalogoLecciones")} · {t("estacionRefam.progresoDetalle", { completadas: progresoPorParticipante[item.id] || 0, total: refamLecciones.length, reuniones: asistenciaPorParticipante[item.id] || 0 })}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {canEdit && item.leccion_actual_id && <button type="button" onClick={() => marcarLeccionCompletada(item)} disabled={saving} className="btn-secondary px-2 py-1 text-xs whitespace-nowrap">{t("estacionRefam.botonMarcarCompletada")}</button>}
                      <button type="button" onClick={() => toggleNotasParticipante(item)} className="text-xs text-accent whitespace-nowrap">{notasAbiertasParticipanteId === item.id ? t("estacionRefam.botonOcultarNotas") : t("estacionRefam.botonVerNotas")}</button>
                    </div>
                  </div>
                  {notasAbiertasParticipanteId === item.id && <div className="bg-surface-1 rounded p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2 flex items-center gap-1">{t("estacionRefam.bitacoraTitulo")}<InfoTip texto={t("estacionRefam.infoBitacora")} /></p>
                    {canEdit && (item.leccion_actual_id ? (
                      <div className="flex flex-col gap-2 mb-3">
                        <textarea className="input-field text-sm min-h-16" placeholder={t("estacionRefam.placeholderNota")} value={nuevaNotaRefam} onChange={(event) => setNuevaNotaRefam(event.target.value)} />
                        <div className="flex items-center gap-2">
                          <select aria-label={t("estacionRefam.ariaQuienAnota")} className="input-field text-xs flex-1" value={nuevaNotaRefamResponsable} onChange={(event) => setNuevaNotaRefamResponsable(event.target.value)}>
                            <option value="">{t("estacionRefam.opcionSinAutor")}</option>
                            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
                          </select>
                          <button type="button" onClick={() => agregarNotaRefam(item)} disabled={saving || !nuevaNotaRefam.trim()} className="btn-secondary px-3 text-xs whitespace-nowrap">{t("estacionRefam.botonAgregarNota")}</button>
                        </div>
                      </div>
                    ) : <p className="text-xs text-muted mb-3">{t("estacionRefam.textoAsignaLeccion")}</p>)}
                    {(notasPorParticipante[item.id] || []).length ? <ul className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">{notasPorParticipante[item.id].map((nota) => (
                      <li key={nota.id} className="text-xs bg-surface-2 rounded p-2.5">
                        <p className="text-secondary">{nota.nota}</p>
                        <p className="text-muted mt-1">{t("estacionRefam.notaDetalle", { numero: nota.leccion?.numero, titulo: nota.leccion?.titulo, responsable: nota.responsable ? `${nota.responsable.nombres} ${nota.responsable.apellidos}` : t("estacionRefam.opcionSinAutor"), fecha: new Date(nota.created_at).toLocaleDateString(i18n.language === "en" ? "en-US" : i18n.language === "pt" ? "pt-BR" : "es-CO") })}</p>
                      </li>
                    ))}</ul> : <p className="text-xs text-muted">{t("estacionRefam.sinNotasRegistradas")}</p>}
                  </div>}
                </div>)}</div> : <p className="text-xs text-muted">{t("estacionRefam.sinParticipantesAun")}</p>}
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">{t("estacionRefam.tituloReuniones")}</h3>
                {canEdit && <form onSubmit={addRefamReunion} className="grid grid-cols-2 gap-2 mb-2">
                  <label className="text-xs text-secondary">{t("estacionRefam.labelFechaReunion")}<input required type="date" className="input-field mt-1" value={refamReunionForm.fecha} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, fecha: event.target.value })} /></label>
                  <label className="text-xs text-secondary">{t("estacionRefam.labelNumeroLeccionVista")}<input type="number" min="1" className="input-field mt-1" placeholder={t("estacionRefam.placeholderNumeroLeccion")} value={refamReunionForm.numero_leccion} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, numero_leccion: event.target.value })} /></label>
                  <label className="text-xs text-secondary col-span-2">{t("estacionRefam.labelTemaTratado")}<input className="input-field mt-1" placeholder={t("estacionRefam.placeholderTemaTratado")} value={refamReunionForm.tema} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, tema: event.target.value })} /></label>
                  <label className="text-xs text-secondary">{t("estacionRefam.labelTotalAsistentes")}<input type="number" min="0" placeholder="0" className="input-field mt-1" value={refamReunionForm.asistentes} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, asistentes: event.target.value })} /></label>
                  <label className="text-xs text-secondary">{t("estacionRefam.labelTotalVisitantes")}<input type="number" min="0" placeholder="0" className="input-field mt-1" value={refamReunionForm.visitantes} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, visitantes: event.target.value })} /></label>
                  <label className="text-xs text-secondary col-span-2">{t("estacionRefam.labelResultadoReunion")}<input className="input-field mt-1" placeholder={t("estacionRefam.placeholderResultado")} value={refamReunionForm.resultado} onChange={(event) => setRefamReunionForm({ ...refamReunionForm, resultado: event.target.value })} /></label>
                  {refamParticipantes.length > 0 && <div className="col-span-2 border border-border rounded-card p-2"><p className="text-xs font-medium mb-1.5">{t("estacionRefam.asistenciaIndividualEstudio")}</p>{refamParticipantes.map((item) => <label key={item.id} className="flex items-center gap-2 text-xs py-0.5"><input type="checkbox" checked={Boolean(asistenciaRefamMarcada[item.id])} onChange={(event) => setAsistenciaRefamMarcada({ ...asistenciaRefamMarcada, [item.id]: event.target.checked })} />{item.personas ? `${item.personas.nombres} ${item.personas.apellidos}` : item.amigos?.nombres || t("estacionRefam.sinNombre")}</label>)}</div>}
                  <button className="btn-secondary col-span-2 justify-center">{t("estacionRefam.botonRegistrarReunion")}</button>
                </form>}
                {refamReuniones.length ? <div className="divide-y divide-border">{refamReuniones.map((item) => <div key={item.id} className="py-1.5 text-sm">{t("estacionRefam.reunionLinea", { fecha: item.fecha, numero: item.numero_leccion, asistentes: item.asistentes })}{item.visitantes ? t("estacionRefam.reunionVisitantesSufijo", { count: item.visitantes }) : ""}</div>)}</div> : <p className="text-xs text-muted">{t("estacionRefam.sinReunionesRegistradas")}</p>}
              </div>
            </div> : <p className="text-sm text-muted">{t("estacionRefam.seleccionaGrupoParticipantes")}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
