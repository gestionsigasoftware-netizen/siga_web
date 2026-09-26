import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Download,
  MapPinned,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { usePreferencias } from "../hooks/usePreferencias";
import { formatFecha } from "../lib/dateFormat";
import { diasDesde, getComitesActivos } from "../lib/rutaEvangelistica";
import { calcularEdad, getRangosEdadComite, sugerirComites } from "../lib/comitesPorPoblacion";
import { avatarTone, initialesDe } from "../lib/avatar";
import { descargarPdf } from "../lib/reportExport";
import { descargarCertificadoBautismo } from "../lib/certificadoBautismo";
import { TELEFONO_TIPO_LABELS } from "../lib/contacto";
import { TIPO_SANGRE_OPCIONES, categoriasPrioridad } from "../lib/saludEmergencia";
import SignaturePad from "../components/SignaturePad";
import InfoTip from "../components/InfoTip";
import Toast from "../components/Toast";

const amigosCache = new Map();

const RUTA_ESTACION_PATH = { uno_mas: "/uno-mas", bis: "/bis", refam: "/refam", esfob: "/esfob", discipulado: "/discipulado" };
// Tono por estación de la Ruta Evangelística -- reemplaza la vieja
// insignia de "Etapa" (etapas_seguimiento) en la lista: la estación es
// el estado que de verdad se usa día a día (traslados, lecciones,
// notas), mientras que Etapa es opcional y muchos amigos quedan "Sin
// etapa". Etapa se conserva en la base de datos y en Configuración
// por si la PWA todavía la usa para capturar amigos en campo -- solo
// deja de ser lo primero que se ve aquí.
const TONO_ESTACION = {
  uno_mas: "bg-surface-1 text-secondary",
  bis: "bg-warning-bg text-warning",
  refam: "bg-accent-bg text-accent",
  esfob: "bg-warning-bg text-warning",
  discipulado: "bg-success-bg text-success",
};
const EMPTY_FORM = {
  nombres: "",
  telefono: "",
  telefono_tipo: "",
  tiene_whatsapp: false,
  telefono_alterno: "",
  red_social: "",
  direccion: "",
  sector: "",
  invitado_por: "",
  fecha_primer_contacto: hoyBogota(),
  etapa_id: "",
  zona_id: "",
  evangelismo_metodologia_id: "",
  fecha_nacimiento: "",
  estado_civil: "soltero",
  genero: "",
  comite_origen_id: "",
  tipo_sangre: "",
  eps_nombre: "",
  condiciones_medicas: "",
  alergias: "",
  medicamentos_actuales: "",
  discapacidad: "",
  embarazada: false,
  fecha_probable_parto: "",
  contacto_emergencia_nombre: "",
  contacto_emergencia_telefono: "",
  contacto_emergencia_parentesco: "",
  autorizacion_datos_salud: false,
  fecha_autorizacion_datos_salud: "",
  consentimiento_datos_firma: "",
  fecha_consentimiento_datos: "",
};
const FRIEND_FIELDS =
  "id, nombres, telefono, telefono_tipo, tiene_whatsapp, telefono_alterno, red_social, direccion, sector, invitado_por, fecha_primer_contacto, etapa_id, zona_id, evangelismo_metodologia_id, convertido, estado_espiritual, persona_id, categoria_asignada_id, fecha_nacimiento, estado_civil, genero, comite_origen_id, created_at, bautizado, fecha_bautismo, sellado, fecha_sellado, tipo_sangre, eps_nombre, condiciones_medicas, alergias, medicamentos_actuales, discapacidad, embarazada, fecha_probable_parto, contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco, autorizacion_datos_salud, fecha_autorizacion_datos_salud, consentimiento_datos_firma, fecha_consentimiento_datos, etapas_seguimiento(nombre, orden), zonas(nombre), comite_origen:comites!amigos_comite_origen_id_fkey(nombre)";

export default function Amigos() {
  const { t } = useTranslation();
  const pageSize = 50;
  const [searchParams] = useSearchParams();
  const station = searchParams.get("station");
  const isBis = station === "bis";
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const { formato_fecha } = usePreferencias();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [etapas, setEtapas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [metodologias, setMetodologias] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [comites, setComites] = useState([]);
  const [amigos, setAmigos] = useState([]);
  const [analysisAmigos, setAnalysisAmigos] = useState([]);
  const [page, setPage] = useState(0);
  const [totalAmigos, setTotalAmigos] = useState(0);
  const [totalConvertidos, setTotalConvertidos] = useState(0);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [transferName, setTransferName] = useState({ nombres: "", apellidos: "" });
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [stageHistory, setStageHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [mostrarFirmaNueva, setMostrarFirmaNueva] = useState(false);
  const [mostrarFirmaEdit, setMostrarFirmaEdit] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const [canEdit, setCanEdit] = useState(null); // null = todavia no se confirma el permiso
  const [rutaActivaPorAmigo, setRutaActivaPorAmigo] = useState({});
  const [ultimoContactoPorAmigo, setUltimoContactoPorAmigo] = useState({});
  const [sinRutaCount, setSinRutaCount] = useState(0);
  const [routeProcess, setRouteProcess] = useState(null);
  const [routeHistory, setRouteHistory] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [rangosEdad, setRangosEdad] = useState([]);
  const [actorPorAuthId, setActorPorAuthId] = useState(new Map());
  const [congregacion, setCongregacion] = useState(null);
  const notesRequest = useRef(0);

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError(t("amigos.sinCongregacion"));
      return;
    }
    const cacheKey = `${congregacionId}:${page}:${filtro}:${busqueda}`;
    const cached = amigosCache.get(cacheKey);
    if (cached) {
      setEtapas(cached.etapas);
      setZonas(cached.zonas);
      setCategorias(cached.categorias);
      setMetodologias(cached.metodologias);
      setAmigos(cached.amigos);
      setTotalAmigos(cached.totalAmigos);
      setTotalConvertidos(cached.totalConvertidos);
      setAnalysisAmigos(cached.analysisAmigos);
      setRutaActivaPorAmigo(cached.rutaActivaPorAmigo);
      setSinRutaCount(cached.sinRutaCount);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const [stageResult, zoneResult, categoryResult, methodResult, friendResult, convertedResult, analysisResult, ultimoContactoResult] =
      await Promise.all([
        supabase
          .from("etapas_seguimiento")
          .select("id, nombre, orden")
          .eq("congregacion_id", congregacionId)
          .order("orden"),
        supabase
          .from("zonas")
          .select("id, nombre")
          .eq("congregacion_id", congregacionId)
          .order("nombre"),
        supabase
          .from("categorias_demograficas")
          .select("id, nombre")
          .eq("congregacion_id", congregacionId)
          .order("orden"),
        supabase
          .from("tipos_actividad")
          .select("id, nombre, modulos!inner(congregacion_id, nombre_modulo)")
          .eq("modulos.congregacion_id", congregacionId)
          .ilike("modulos.nombre_modulo", "Evangelismo")
          .order("nombre"),
        (() => {
          let query = supabase
            .from("amigos")
            .select(FRIEND_FIELDS, { count: "exact" })
            .eq("congregacion_id", congregacionId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(page * pageSize, page * pageSize + pageSize - 1);
          if (filtro !== "todos") query = query.eq("etapa_id", filtro);
          if (busqueda.trim()) query = query.or(`nombres.ilike.%${busqueda.trim()}%,sector.ilike.%${busqueda.trim()}%,telefono.ilike.%${busqueda.trim()}%`);
          return query;
        })(),
        supabase.from("amigos").select("id", { count: "exact", head: true }).eq("congregacion_id", congregacionId).eq("convertido", true),
        supabase.from("amigos").select("id, etapa_id, zona_id, evangelismo_metodologia_id, convertido, fecha_primer_contacto, sellado").eq("congregacion_id", congregacionId),
        // "Último contacto" calculado (ver vw_ultimo_contacto_amigos): en vez
        // de un campo nuevo para escribir a mano, toma la fecha mas reciente
        // entre notas/visitas BIS/lecciones ESFOB/compromisos Uno Mas/cambios
        // de estacion que el personal ya registra como parte de su trabajo.
        supabase.from("vw_ultimo_contacto_amigos").select("amigo_id, ultimo_contacto").eq("congregacion_id", congregacionId),
      ]);
    if (
      stageResult.error ||
      zoneResult.error ||
      categoryResult.error ||
      methodResult.error ||
      friendResult.error ||
      convertedResult.error
      || analysisResult.error
    )
      setError(t("amigos.errorRuta"));
    const friendIds = (friendResult.data ?? []).map((friend) => friend.id);
    let rutaActivaPorAmigo = {};
    if (friendIds.length) {
      const { data: rutaData } = await supabase
        .from("ruta_procesos")
        .select("amigo_id, estacion:ruta_estaciones!ruta_procesos_estacion_id_fkey(codigo, nombre)")
        .in("amigo_id", friendIds)
        .in("estado", ["activo", "pausado"]);
      rutaActivaPorAmigo = Object.fromEntries((rutaData ?? []).map((item) => [item.amigo_id, item.estacion]));
    }
    // "Sin ruta iniciada": amigos sin bautizar que todavia no tienen una
    // fila activa/pausada en ruta_procesos -- a diferencia de "etapas
    // configuradas" (un dato de catalogo, no accionable), esto si dice
    // a quien falta arrancar en alguna estacion.
    const { data: rutaCongregacion } = await supabase
      .from("ruta_procesos")
      .select("amigo_id")
      .eq("congregacion_id", congregacionId)
      .in("estado", ["activo", "pausado"])
      .not("amigo_id", "is", null);
    const amigosConRutaActiva = new Set((rutaCongregacion ?? []).map((item) => item.amigo_id));
    const enRuta = (analysisResult.data ?? []).filter((amigo) => !amigo.convertido);
    // No bloquea la carga de la pantalla si la vista todavia no existe
    // (falta ejecutar el SQL en produccion) -- se degrada a "sin datos".
    const ultimoContactoPorAmigo = Object.fromEntries((ultimoContactoResult?.data ?? []).map((item) => [item.amigo_id, item.ultimo_contacto]));
    const freshData = {
      etapas: stageResult.data ?? [],
      zonas: zoneResult.data ?? [],
      categorias: categoryResult.data ?? [],
      metodologias: methodResult.data ?? [],
      amigos: friendResult.data ?? [],
      totalAmigos: friendResult.count ?? 0,
      totalConvertidos: convertedResult.count ?? 0,
      analysisAmigos: analysisResult.data ?? [],
      rutaActivaPorAmigo,
      sinRutaCount: enRuta.filter((amigo) => !amigosConRutaActiva.has(amigo.id)).length,
      ultimoContactoPorAmigo,
    };
    setEtapas(freshData.etapas);
    setZonas(freshData.zonas);
    setCategorias(freshData.categorias);
    setMetodologias(freshData.metodologias);
    setAmigos(freshData.amigos);
    setTotalAmigos(freshData.totalAmigos);
    setTotalConvertidos(freshData.totalConvertidos);
    setAnalysisAmigos(freshData.analysisAmigos);
    setRutaActivaPorAmigo(freshData.rutaActivaPorAmigo);
    setSinRutaCount(freshData.sinRutaCount);
    setUltimoContactoPorAmigo(freshData.ultimoContactoPorAmigo);
    setLoading(false);
    amigosCache.set(cacheKey, freshData);
  }

  useEffect(() => {
    load();
  }, [congregacionId, page, filtro, busqueda]);

  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "evangelismo.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  useEffect(() => {
    setPage(0);
  }, [filtro, busqueda]);

  useEffect(() => {
    if (!congregacionId) return;
    getRangosEdadComite(congregacionId).then(({ data }) => setRangosEdad(data ?? []));
    getComitesActivos(congregacionId).then(({ data }) => setComites(data ?? []));
    // Nombre de la sede y del pastor local -- se usan en el certificado de
    // bautismo descargable, no hace falta volver a pedirlos por persona.
    supabase
      .from("congregaciones")
      .select("nombre, pastor_nombre")
      .eq("id", congregacionId)
      .maybeSingle()
      .then(({ data }) => setCongregacion(data));
    // Para resolver el usuario_id crudo del historial de etapas a un
    // nombre real en vez de mostrar el UUID tal cual.
    supabase
      .from("personas")
      .select("auth_user_id, nombres, apellidos")
      .eq("congregacion_id", congregacionId)
      .not("auth_user_id", "is", null)
      .then(({ data }) => setActorPorAuthId(new Map((data ?? []).map((persona) => [persona.auth_user_id, `${persona.nombres} ${persona.apellidos}`]))));
  }, [congregacionId]);

  const totalPages = Math.max(1, Math.ceil(totalAmigos / pageSize));
  const filtrados = useMemo(() => amigos, [amigos]);
  const converted = totalConvertidos;
  const active = Math.max(totalAmigos - converted, 0);

  function selectFriend(friend) {
    notesRequest.current += 1;
    setSelected(friend);
    setEditForm({
      nombres: friend.nombres || "",
      telefono: friend.telefono || "",
      telefono_tipo: friend.telefono_tipo || "",
      tiene_whatsapp: Boolean(friend.tiene_whatsapp),
      telefono_alterno: friend.telefono_alterno || "",
      red_social: friend.red_social || "",
      direccion: friend.direccion || "",
      sector: friend.sector || "",
      invitado_por: friend.invitado_por || "",
      fecha_primer_contacto: friend.fecha_primer_contacto || "",
      etapa_id: friend.etapa_id || "",
      zona_id: friend.zona_id || "",
      evangelismo_metodologia_id: friend.evangelismo_metodologia_id || "",
      fecha_nacimiento: friend.fecha_nacimiento || "",
      estado_civil: friend.estado_civil || "soltero",
      genero: friend.genero || "",
      comite_origen_id: friend.comite_origen_id || "",
      tipo_sangre: friend.tipo_sangre || "",
      eps_nombre: friend.eps_nombre || "",
      condiciones_medicas: friend.condiciones_medicas || "",
      alergias: friend.alergias || "",
      medicamentos_actuales: friend.medicamentos_actuales || "",
      discapacidad: friend.discapacidad || "",
      embarazada: Boolean(friend.embarazada),
      fecha_probable_parto: friend.fecha_probable_parto || "",
      contacto_emergencia_nombre: friend.contacto_emergencia_nombre || "",
      contacto_emergencia_telefono: friend.contacto_emergencia_telefono || "",
      contacto_emergencia_parentesco: friend.contacto_emergencia_parentesco || "",
      autorizacion_datos_salud: Boolean(friend.autorizacion_datos_salud),
      fecha_autorizacion_datos_salud: friend.fecha_autorizacion_datos_salud || "",
      consentimiento_datos_firma: friend.consentimiento_datos_firma || "",
      fecha_consentimiento_datos: friend.fecha_consentimiento_datos || "",
    });
    const nameParts = (friend.nombres || "").trim().split(/\s+/);
    setTransferName({ nombres: nameParts.slice(0, -1).join(" ") || friend.nombres || "", apellidos: nameParts.slice(-1).join("") });
    setNotes([]);
    setStageHistory([]);
    setNewNote("");
    setNotesLoading(true);
    setHistoryLoading(true);
    setRouteLoading(true);
    setRouteProcess(null);
    setRouteHistory([]);
    setError(null);
    setNotice(null);
    const requestId = notesRequest.current;
    supabase
      .from("amigos_notas")
      .select("id, nota, created_at")
      .eq("amigo_id", friend.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: notesError }) => {
        if (requestId !== notesRequest.current) return;
        if (notesError) setError(t("amigos.errorNotas"));
        setNotes(data ?? []);
        setNotesLoading(false);
      });
    supabase
      .from("historial_amigos")
      .select("id, etapa_anterior_id, etapa_nueva_id, observacion, usuario_id, creado_en, etapa_anterior:etapas_seguimiento!historial_amigos_etapa_anterior_id_fkey(nombre), etapa_nueva:etapas_seguimiento!historial_amigos_etapa_nueva_id_fkey(nombre)")
      .eq("amigo_id", friend.id)
      .order("creado_en", { ascending: false })
      .then(({ data, error: historyError }) => {
        if (requestId !== notesRequest.current) return;
        if (historyError) setError(t("amigos.errorHistorialEtapas"));
        setStageHistory(data ?? []);
        setHistoryLoading(false);
      });
    supabase
      .from("ruta_procesos")
      .select("id, estado, fecha_inicio, fecha_cierre, resultado, estacion_id, estacion:ruta_estaciones!ruta_procesos_estacion_id_fkey(id, codigo, nombre, orden), responsable:personas!ruta_procesos_responsable_persona_id_fkey(nombres, apellidos)")
      .eq("amigo_id", friend.id)
      .order("fecha_inicio", { ascending: true })
      .then(({ data, error: routeError }) => {
        if (requestId !== notesRequest.current) return;
        if (routeError) setError(t("amigos.errorRutaActual"));
        const historial = data ?? [];
        setRouteHistory(historial);
        setRouteProcess(historial.find((row) => row.estado === "activo" || row.estado === "pausado") ?? null);
        setRouteLoading(false);
      });
  }

  async function createFriend(event) {
    event.preventDefault();
    if (!canEdit) { setError(t("amigos.errorSoloConsulta")); return; }
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      etapa_id: form.etapa_id || null,
      zona_id: form.zona_id || null,
      evangelismo_metodologia_id: form.evangelismo_metodologia_id || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      genero: form.genero || null,
      comite_origen_id: form.comite_origen_id || null,
      autorizacion_datos_salud: Boolean(form.autorizacion_datos_salud),
      fecha_autorizacion_datos_salud: form.autorizacion_datos_salud ? (form.fecha_autorizacion_datos_salud || hoyBogota()) : null,
      tipo_sangre: form.autorizacion_datos_salud ? (form.tipo_sangre || null) : null,
      eps_nombre: form.autorizacion_datos_salud ? (form.eps_nombre?.trim() || null) : null,
      condiciones_medicas: form.autorizacion_datos_salud ? (form.condiciones_medicas?.trim() || null) : null,
      alergias: form.autorizacion_datos_salud ? (form.alergias?.trim() || null) : null,
      medicamentos_actuales: form.autorizacion_datos_salud ? (form.medicamentos_actuales?.trim() || null) : null,
      discapacidad: form.autorizacion_datos_salud ? (form.discapacidad?.trim() || null) : null,
      embarazada: form.autorizacion_datos_salud ? Boolean(form.embarazada) : false,
      fecha_probable_parto: form.autorizacion_datos_salud && form.embarazada ? (form.fecha_probable_parto || null) : null,
      contacto_emergencia_nombre: form.autorizacion_datos_salud ? (form.contacto_emergencia_nombre?.trim() || null) : null,
      contacto_emergencia_telefono: form.autorizacion_datos_salud ? (form.contacto_emergencia_telefono?.trim() || null) : null,
      contacto_emergencia_parentesco: form.autorizacion_datos_salud ? (form.contacto_emergencia_parentesco?.trim() || null) : null,
      consentimiento_datos_firma: form.consentimiento_datos_firma || null,
      fecha_consentimiento_datos: form.consentimiento_datos_firma ? (form.fecha_consentimiento_datos || hoyBogota()) : null,
      congregacion_id: congregacionId,
    };
    const { data, error: insertError } = await supabase
      .from("amigos")
      .insert(payload)
      .select(FRIEND_FIELDS)
      .single();
    setSaving(false);
    if (insertError) {
      setError(t("amigos.errorRegistrar", { mensaje: insertError.message }));
      return;
    }
    setAmigos((current) => [data, ...current]);
    setForm({
      ...EMPTY_FORM,
      fecha_primer_contacto: hoyBogota(),
    });
    setShowForm(false);
    selectFriend(data);
  }

  async function saveFriend(event) {
    event.preventDefault();
    if (!canEdit) { setError(t("amigos.errorSoloConsulta")); return; }
    if (!selected) return;
    setSaving(true);
    setError(null);
    const payload = {
      ...editForm,
      etapa_id: editForm.etapa_id || null,
      zona_id: editForm.zona_id || null,
      evangelismo_metodologia_id: editForm.evangelismo_metodologia_id || null,
      fecha_nacimiento: editForm.fecha_nacimiento || null,
      genero: editForm.genero || null,
      comite_origen_id: editForm.comite_origen_id || null,
      autorizacion_datos_salud: Boolean(editForm.autorizacion_datos_salud),
      fecha_autorizacion_datos_salud: editForm.autorizacion_datos_salud ? (editForm.fecha_autorizacion_datos_salud || hoyBogota()) : null,
      tipo_sangre: editForm.autorizacion_datos_salud ? (editForm.tipo_sangre || null) : null,
      eps_nombre: editForm.autorizacion_datos_salud ? (editForm.eps_nombre?.trim() || null) : null,
      condiciones_medicas: editForm.autorizacion_datos_salud ? (editForm.condiciones_medicas?.trim() || null) : null,
      alergias: editForm.autorizacion_datos_salud ? (editForm.alergias?.trim() || null) : null,
      medicamentos_actuales: editForm.autorizacion_datos_salud ? (editForm.medicamentos_actuales?.trim() || null) : null,
      discapacidad: editForm.autorizacion_datos_salud ? (editForm.discapacidad?.trim() || null) : null,
      embarazada: editForm.autorizacion_datos_salud ? Boolean(editForm.embarazada) : false,
      fecha_probable_parto: editForm.autorizacion_datos_salud && editForm.embarazada ? (editForm.fecha_probable_parto || null) : null,
      contacto_emergencia_nombre: editForm.autorizacion_datos_salud ? (editForm.contacto_emergencia_nombre?.trim() || null) : null,
      contacto_emergencia_telefono: editForm.autorizacion_datos_salud ? (editForm.contacto_emergencia_telefono?.trim() || null) : null,
      contacto_emergencia_parentesco: editForm.autorizacion_datos_salud ? (editForm.contacto_emergencia_parentesco?.trim() || null) : null,
      consentimiento_datos_firma: editForm.consentimiento_datos_firma || null,
      fecha_consentimiento_datos: editForm.consentimiento_datos_firma ? (editForm.fecha_consentimiento_datos || hoyBogota()) : null,
    };
    const { data, error: updateError } = await supabase
      .from("amigos")
      .update(payload)
      .eq("id", selected.id)
      .eq("congregacion_id", congregacionId)
      .select(FRIEND_FIELDS)
      .single();
    setSaving(false);
    if (updateError) {
      setError(t("amigos.errorActualizar", { mensaje: updateError.message }));
      return;
    }
    setAmigos((current) =>
      current.map((friend) => (friend.id === data.id ? data : friend)),
    );
    setSelected(data);
    setEditForm({
      ...payload,
      etapa_id: data.etapa_id || "",
      zona_id: data.zona_id || "",
      evangelismo_metodologia_id: data.evangelismo_metodologia_id || "",
    });
    setNotice(t("amigos.cambiosGuardados"));
  }

  async function markBaptized() {
    if (!selected) return;
    if (!canEdit) { setError(t("amigos.errorEstadoEspiritual")); return; }
    if (selected.persona_id) {
      setError(t("amigos.errorYaFeligresia"));
      return;
    }
    setSaving(true);
    setError(null);
    const becomingBaptized = selected.estado_espiritual !== "bautizado";
    const values = {
      estado_espiritual: becomingBaptized ? "bautizado" : "en_ruta",
      convertido: becomingBaptized,
      ...(becomingBaptized ? { bautizado: true, fecha_bautismo: selected.fecha_bautismo || hoyBogota() } : {}),
    };
    const { error: updateError } = await supabase
      .from("amigos")
      .update(values)
      .eq("id", selected.id)
      .eq("congregacion_id", congregacionId);
    setSaving(false);
    if (updateError) {
      setError(t("amigos.errorConversion", { mensaje: updateError.message }));
      return;
    }
    setAmigos((current) =>
      current.map((friend) =>
        friend.id === selected.id ? { ...friend, ...values } : friend,
      ),
    );
    setSelected((current) => ({ ...current, ...values }));
  }

  async function markSealed() {
    if (!selected || selected.sellado) return;
    if (!canEdit) { setError(t("amigos.errorEstadoEspiritual")); return; }
    setSaving(true);
    setError(null);
    const values = { sellado: true, fecha_sellado: hoyBogota() };
    const { error: updateError } = await supabase
      .from("amigos")
      .update(values)
      .eq("id", selected.id)
      .eq("congregacion_id", congregacionId);
    setSaving(false);
    if (updateError) { setError(t("amigos.errorSellado", { mensaje: updateError.message })); return; }
    setAmigos((current) => current.map((friend) => (friend.id === selected.id ? { ...friend, ...values } : friend)));
    setSelected((current) => ({ ...current, ...values }));
  }

  async function descargarCertificado() {
    if (!selected || selected.estado_espiritual !== "bautizado") return;
    setError(null);
    try {
      await descargarCertificadoBautismo({
        nombreCompleto: selected.nombres,
        fechaBautismo: selected.fecha_bautismo,
        congregacionNombre: congregacion?.nombre,
        pastorNombre: congregacion?.pastor_nombre,
      });
    } catch (pdfError) {
      setError(t("amigos.errorCertificado", { mensaje: pdfError.message }));
    }
  }

  async function incorporateIntoFeligresia() {
    if (!selected || selected.estado_espiritual !== "bautizado") return;
    if (!canEdit) { setError(t("amigos.errorIncorporarPermiso")); return; }
    if (!editForm.fecha_nacimiento) {
      setError(t("amigos.errorFechaNacimientoRequerida"));
      return;
    }
    setSaving(true);
    setError(null);
    const { data: personaId, error: transferError } = await supabase.rpc("incorporar_amigo_bautizado", {
      p_amigo_id: selected.id,
      p_nombres: transferName.nombres,
      p_apellidos: transferName.apellidos,
      p_fecha_nacimiento: editForm.fecha_nacimiento || null,
      p_estado_civil: editForm.estado_civil || "soltero",
      p_fecha_ingreso: hoyBogota(),
    });
    setSaving(false);
    if (transferError) {
      setError(t("amigos.errorIncorporar", { mensaje: transferError.message }));
      return;
    }
    setSelected((current) => ({ ...current, persona_id: personaId }));
    setAmigos((current) => current.map((friend) => friend.id === selected.id ? { ...friend, persona_id: personaId } : friend));
  }

  async function exportarRecorrido() {
    if (!selected || !routeHistory.length) return;
    await descargarPdf({
      filename: `recorrido-${selected.nombres.replace(/\s+/g, "-").toLowerCase()}.pdf`,
      titulo: t("amigos.recorridoTitulo", { nombre: selected.nombres }),
      meta: [`${t("amigos.primerContacto")}: ${formatFecha(selected.fecha_primer_contacto, { formato: formato_fecha })}`, `${t("amigos.estado")}: ${selected.convertido ? t("amigos.estadoConvertido") : t("amigos.estadoEnRuta")}`],
      headers: [t("amigos.colEstacion"), t("amigos.colInicio"), t("amigos.colCierre"), t("amigos.colResponsable")],
      rows: routeHistory.map((row) => [
        row.estacion?.nombre || t("amigos.sinNombre"),
        formatFecha(row.fecha_inicio, { formato: formato_fecha }),
        row.fecha_cierre ? formatFecha(row.fecha_cierre, { formato: formato_fecha }) : t("amigos.enCurso"),
        row.responsable ? `${row.responsable.nombres} ${row.responsable.apellidos}` : t("amigos.sinAsignar"),
      ]),
    });
  }

  async function removeFriend() {
    if (!canEdit) { setError(t("amigos.errorEliminarPermiso")); return; }
    if (
      !selected ||
      !window.confirm(t("amigos.confirmEliminar", { nombre: selected.nombres }))
    )
      return;
    setSaving(true);
    const { error: deleteError } = await supabase
      .from("amigos")
      .delete()
      .eq("id", selected.id)
      .eq("congregacion_id", congregacionId);
    setSaving(false);
    if (deleteError) {
      setError(t("amigos.errorEliminar", { mensaje: deleteError.message }));
      return;
    }
    setAmigos((current) =>
      current.filter((friend) => friend.id !== selected.id),
    );
    setSelected(null);
  }

  async function addNote(event) {
    event.preventDefault();
    if (!canEdit) { setError(t("amigos.errorNotasPermiso")); return; }
    if (!selected || !newNote.trim()) return;
    setSaving(true);
    const { data, error: noteError } = await supabase
      .from("amigos_notas")
      .insert({ amigo_id: selected.id, nota: newNote.trim() })
      .select("id, nota, created_at")
      .single();
    setSaving(false);
    if (noteError) {
      setError(t("amigos.errorGuardarNota"));
      return;
    }
    setNotes((current) => [data, ...current]);
    setNewNote("");
  }

  // Acción de un solo toque para "último contacto": reutiliza amigos_notas
  // (la misma tabla que ya alimenta vw_ultimo_contacto_amigos) en vez de un
  // campo nuevo -- así no hay una fecha manual más que alguien tenga que
  // recordar escribir, y el badge de "días sin contacto" se actualiza solo.
  async function marcarContactoHoy() {
    if (!canEdit) { setError(t("amigos.errorNotasPermiso")); return; }
    if (!selected) return;
    setSaving(true);
    const { data, error: noteError } = await supabase
      .from("amigos_notas")
      .insert({ amigo_id: selected.id, nota: "Contacto registrado" })
      .select("id, nota, created_at")
      .single();
    setSaving(false);
    if (noteError) { setError(t("amigos.errorRegistrarContacto")); return; }
    setNotes((current) => [data, ...current]);
    setUltimoContactoPorAmigo((current) => ({ ...current, [selected.id]: hoyBogota() }));
    setNotice(t("amigos.contactoRegistrado"));
  }

  if (roleLoading || loading)
    return (
      <div className="module-loading" role="status">
        <span className="loading-dot" />
        {t("amigos.cargandoRuta")}
      </div>
    );
  if (!congregacionId)
    return (
      <div className="card p-8 text-center text-sm text-secondary">{error}</div>
    );

  const edadSelected = selected ? calcularEdad(selected.fecha_nacimiento) : null;
  const comitesSugeridos = edadSelected !== null && edadSelected !== undefined
    ? sugerirComites({ edad: edadSelected, genero: selected.genero, estadoCivil: editForm.estado_civil }, rangosEdad)
    : [];

  return (
    <div className={`page-shell ${canEdit === false ? "amigos-read-only" : ""}`}>
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to="/misiones-evangelismo" className="btn-secondary mb-4">
            <ArrowLeft className="w-4 h-4" />
            {t("amigos.volverMisiones")}
          </Link>
          <p className="eyebrow">{t("amigos.eyebrow")}</p>
          <h1 className="section-title">{t("amigos.titulo")}</h1>
          <p className="text-sm text-secondary mt-1">
            {t("amigos.subtitulo")}
          </p>
        </div>
        {canEdit && !isBis && <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          {showForm ? t("amigos.cerrarRegistro") : t("amigos.registrarAmigo")}
        </button>}
      </header>
      {isBis && <p className="text-sm text-secondary bg-accent-bg rounded p-3">{t("amigos.bisAviso")}</p>}
      {error && (
        <p
          role="alert"
          className="text-sm text-danger bg-danger-bg rounded p-3"
        >
          {error}
        </p>
      )}
      <Toast>{notice}</Toast>
      <section className="grid sm:grid-cols-3 gap-3">
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">
            {t("amigos.enAcompanamiento")}
          </p>
          <p className="text-2xl font-semibold mt-3">{active}</p>
        </div>
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary">
            {t("amigos.convertidos")}
          </p>
          <p className="text-2xl font-semibold mt-3 text-success">
            {converted}
          </p>
        </div>
        <div className="stat-tile">
          <p className="text-[10px] uppercase tracking-[0.14em] text-secondary flex items-center gap-1.5">
            {t("amigos.sinRutaIniciada")}
            <InfoTip texto={t("amigos.sinRutaTip")} />
          </p>
          <p className={`text-2xl font-semibold mt-3 ${sinRutaCount ? "text-warning" : ""}`}>{sinRutaCount}</p>
        </div>
      </section>
      <FriendInsights amigos={analysisAmigos} etapas={etapas} zonas={zonas} metodologias={metodologias} ultimoContactoPorAmigo={ultimoContactoPorAmigo} />
      {showForm && (
        <form
          onSubmit={createFriend}
          className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
        >
          <label className="text-sm">
            {t("amigos.nombreCompleto")}
            <input
              required
              className="input-field mt-1.5"
              value={form.nombres}
              onChange={(event) =>
                setForm({ ...form, nombres: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            {t("amigos.telefono")}
            <input
              className="input-field mt-1.5"
              value={form.telefono}
              onChange={(event) =>
                setForm({ ...form, telefono: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            {t("amigos.tipoTelefono")}
            <select
              className="input-field mt-1.5 w-full"
              value={form.telefono_tipo}
              onChange={(event) =>
                setForm({ ...form, telefono_tipo: event.target.value })
              }
            >
              <option value="">{t("amigos.sinRegistrar")}</option>
              {Object.entries(TELEFONO_TIPO_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm mt-6">
            <input
              type="checkbox"
              checked={form.tiene_whatsapp}
              onChange={(event) =>
                setForm({ ...form, tiene_whatsapp: event.target.checked })
              }
            />
            {t("amigos.tieneWhatsappLargo")}
          </label>
          <label className="text-sm">
            {t("amigos.telefonoAlterno")}
            <input
              className="input-field mt-1.5"
              value={form.telefono_alterno}
              onChange={(event) =>
                setForm({ ...form, telefono_alterno: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            {t("amigos.redSocial")}
            <InfoTip texto={t("amigos.redSocialTip")} />
            <input
              className="input-field mt-1.5 w-full"
              placeholder={t("amigos.redSocialPlaceholder")}
              value={form.red_social}
              onChange={(event) =>
                setForm({ ...form, red_social: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            {t("amigos.direccion")}
            <input
              className="input-field mt-1.5"
              value={form.direccion}
              onChange={(event) =>
                setForm({ ...form, direccion: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            {t("amigos.sector")}
            <input
              className="input-field mt-1.5"
              value={form.sector}
              onChange={(event) =>
                setForm({ ...form, sector: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            {t("amigos.invitadoPor")}
            <input
              className="input-field mt-1.5"
              value={form.invitado_por}
              onChange={(event) =>
                setForm({ ...form, invitado_por: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            {t("amigos.primerContacto")}
            <input
              type="date"
              className="input-field mt-1.5"
              value={form.fecha_primer_contacto}
              onChange={(event) =>
                setForm({ ...form, fecha_primer_contacto: event.target.value })
              }
            />
          </label>
          <label className="text-sm">
            {t("amigos.zonaResponsable")}
            <select
              className="input-field mt-1.5"
              value={form.zona_id}
              onChange={(event) =>
                setForm({ ...form, zona_id: event.target.value })
              }
            >
              <option value="">{t("amigos.sinZona")}</option>
              {zonas.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t("amigos.metodologiaEvangelismo")}
            <select
              className="input-field mt-1.5"
              value={form.evangelismo_metodologia_id}
              onChange={(event) =>
                setForm({ ...form, evangelismo_metodologia_id: event.target.value })
              }
            >
              <option value="">{t("amigos.sinMetodologia")}</option>
              {metodologias.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t("amigos.etapaInicial")}
            <select
              className="input-field mt-1.5"
              value={form.etapa_id}
              onChange={(event) =>
                setForm({ ...form, etapa_id: event.target.value })
              }
            >
              <option value="">{t("amigos.sinEtapa")}</option>
              {etapas.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm flex items-center gap-1">
            {t("amigos.comiteRecibio")}
            <InfoTip texto={t("amigos.comiteRecibioTipCrear")} />
            <select
              className="input-field mt-1.5 w-full"
              value={form.comite_origen_id}
              onChange={(event) =>
                setForm({ ...form, comite_origen_id: event.target.value })
              }
            >
              <option value="">{t("amigos.sinComiteAsignado")}</option>
              {comites.map((comite) => (
                <option key={comite.id} value={comite.id}>
                  {comite.nombre}
                </option>
              ))}
            </select>
          </label>
          <details className="sm:col-span-2 lg:col-span-4 border-t border-border pt-3">
            <summary className="text-sm font-medium cursor-pointer select-none">{t("amigos.fichaSalud")}</summary>
            <p className="text-xs text-secondary mt-2">{t("amigos.fichaSaludDesc")}</p>
            <label className="flex items-center gap-2 text-sm mt-3">
              <input type="checkbox" checked={Boolean(form.autorizacion_datos_salud)} onChange={(event) => setForm({ ...form, autorizacion_datos_salud: event.target.checked, fecha_autorizacion_datos_salud: event.target.checked ? (form.fecha_autorizacion_datos_salud || hoyBogota()) : "" })} />
              {t("amigos.autorizaSalud")}
              <InfoTip texto={t("amigos.autorizaSaludTip")} />
            </label>
            {form.autorizacion_datos_salud && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <label className="text-sm">{t("amigos.tipoSangre")}<select className="input-field mt-1.5 w-full" value={form.tipo_sangre} onChange={(event) => setForm({ ...form, tipo_sangre: event.target.value })}><option value="">{t("amigos.sinRegistrar")}</option>{TIPO_SANGRE_OPCIONES.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select></label>
              <label className="text-sm">{t("amigos.eps")}<input className="input-field mt-1.5" value={form.eps_nombre} onChange={(event) => setForm({ ...form, eps_nombre: event.target.value })} /></label>
              <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={Boolean(form.embarazada)} onChange={(event) => setForm({ ...form, embarazada: event.target.checked })} /> {t("amigos.embarazada")}</label>
              {form.embarazada && <label className="text-sm">{t("amigos.fechaProbableParto")}<input type="date" className="input-field mt-1.5" value={form.fecha_probable_parto} onChange={(event) => setForm({ ...form, fecha_probable_parto: event.target.value })} /></label>}
              <label className="text-sm sm:col-span-2 lg:col-span-4">{t("amigos.condicionesMedicas")}<textarea className="input-field mt-1.5 min-h-16 w-full" value={form.condiciones_medicas} onChange={(event) => setForm({ ...form, condiciones_medicas: event.target.value })} /></label>
              <label className="text-sm sm:col-span-2 lg:col-span-4">{t("amigos.alergias")}<textarea className="input-field mt-1.5 min-h-16 w-full" value={form.alergias} onChange={(event) => setForm({ ...form, alergias: event.target.value })} /></label>
              <label className="text-sm sm:col-span-2 lg:col-span-4">{t("amigos.medicamentosActuales")}<InfoTip texto={t("amigos.medicamentosTip")} /><textarea className="input-field mt-1.5 min-h-16 w-full" value={form.medicamentos_actuales} onChange={(event) => setForm({ ...form, medicamentos_actuales: event.target.value })} /></label>
              <label className="text-sm sm:col-span-2 lg:col-span-4">{t("amigos.discapacidad")}<input className="input-field mt-1.5 w-full" placeholder={t("amigos.discapacidadPlaceholder")} value={form.discapacidad} onChange={(event) => setForm({ ...form, discapacidad: event.target.value })} /></label>
              <label className="text-sm">{t("amigos.contactoEmergencia")}<input className="input-field mt-1.5" placeholder={t("amigos.contactoEmergenciaPlaceholderNombre")} value={form.contacto_emergencia_nombre} onChange={(event) => setForm({ ...form, contacto_emergencia_nombre: event.target.value })} /></label>
              <label className="text-sm mt-6"><input className="input-field" placeholder={t("amigos.contactoEmergenciaPlaceholderTelefono")} value={form.contacto_emergencia_telefono} onChange={(event) => setForm({ ...form, contacto_emergencia_telefono: event.target.value })} /></label>
              <label className="text-sm mt-6"><input className="input-field" placeholder={t("amigos.contactoEmergenciaPlaceholderParentesco")} value={form.contacto_emergencia_parentesco} onChange={(event) => setForm({ ...form, contacto_emergencia_parentesco: event.target.value })} /></label>
            </div>}
          </details>
          <details className="sm:col-span-2 lg:col-span-4 border-t border-border pt-3">
            <summary className="text-sm font-medium cursor-pointer select-none">{t("amigos.consentimientoDatos")}{form.consentimiento_datos_firma ? ` · ${t("amigos.firmado")}` : ""}</summary>
            <p className="text-xs text-secondary mt-2">{t("amigos.consentimientoDesc")}</p>
            {form.consentimiento_datos_firma ? <div className="mt-3">
              <p className="text-xs text-secondary">{t("amigos.firmadoEl", { fecha: formatFecha(form.fecha_consentimiento_datos, { formato: formato_fecha }) })}</p>
              <img src={form.consentimiento_datos_firma} alt={t("amigos.firmaAlt")} className="border border-border rounded bg-white mt-2 h-20" />
              <div className="mt-2"><button type="button" onClick={() => setForm({ ...form, consentimiento_datos_firma: "", fecha_consentimiento_datos: "" })} className="text-xs text-danger">{t("amigos.revocarConsentimiento")}</button></div>
            </div> : mostrarFirmaNueva ? <div className="mt-3"><SignaturePad onGuardar={(firma) => { setForm({ ...form, consentimiento_datos_firma: firma, fecha_consentimiento_datos: hoyBogota() }); setMostrarFirmaNueva(false) }} onCancelar={() => setMostrarFirmaNueva(false)} /></div> : <button type="button" onClick={() => setMostrarFirmaNueva(true)} className="btn-secondary text-xs mt-3">{t("amigos.capturarFirma")}</button>}
          </details>
          <button disabled={saving} className="btn-secondary justify-center">
            {saving ? t("amigos.guardando") : t("amigos.guardarAmigo")}
          </button>
        </form>
      )}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex items-center gap-2 border border-border rounded px-3 py-2 w-full sm:w-64 focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent">
          <Search className="w-4 h-4 text-muted" />
          <input
            aria-label={t("amigos.buscarAmigosLabel")}
            className="bg-transparent outline-none text-sm w-full"
            placeholder={t("amigos.buscarAmigoPlaceholder")}
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </div>
        <div
          role="group"
          aria-label={t("amigos.filtrarPorEtapa")}
          className="flex items-center gap-2 flex-wrap"
        >
          <span className="text-xs text-secondary flex items-center gap-1">
            {t("amigos.etapa")}
            <InfoTip texto={t("amigos.etapaFiltroTip")} />
          </span>
          <button
            type="button"
            aria-pressed={filtro === "todos"}
            onClick={() => setFiltro("todos")}
            className={`text-xs px-3 py-1.5 rounded-full border ${filtro === "todos" ? "bg-accent-bg text-accent border-accent/20" : "border-border text-secondary"}`}
          >
            {t("amigos.todos")}
          </button>
          {etapas.map((stage) => (
            <button
              type="button"
              key={stage.id}
              aria-pressed={filtro === stage.id}
              onClick={() => setFiltro(stage.id)}
              className={`text-xs px-3 py-1.5 rounded-full border ${filtro === stage.id ? "bg-accent-bg text-accent border-accent/20" : "border-border text-secondary"}`}
            >
              {stage.nombre}
            </button>
          ))}
        </div>
      </div>
      {totalAmigos > 0 && <div className="flex items-center justify-between gap-3 text-xs text-secondary"><span>{t("amigos.pagina", { actual: page + 1, total: totalPages, cantidad: totalAmigos })}</span><div className="flex gap-2"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)} className="btn-secondary px-3">{t("amigos.anterior")}</button><button type="button" disabled={page >= totalPages - 1 || loading} onClick={() => setPage((current) => current + 1)} className="btn-secondary px-3">{t("amigos.siguiente")}</button></div></div>}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div>
          {filtrados.length === 0 ? (
            <div className="card p-8 text-center text-sm text-secondary">
              <MapPinned className="w-8 h-8 text-muted mx-auto mb-3" />
              {t("amigos.sinCoincidencias")}
            </div>
          ) : (
            <div className="grid xl:grid-cols-2 gap-3">
              {filtrados.map((friend) => {
                const tone = avatarTone(friend.id);
                return (
                  <button
                    type="button"
                    key={friend.id}
                    onClick={() => selectFriend(friend)}
                    className={`card p-4 text-left flex justify-between items-center gap-3 hover:border-accent transition-colors ${selected?.id === friend.id ? "border-accent ring-1 ring-accent/20" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="censo-avatar" style={{ background: tone.bg, color: tone.fg }}>{initialesDe(friend)}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {friend.nombres}
                        </p>
                        <p className="text-xs text-secondary truncate">
                          {friend.sector ||
                            friend.zonas?.nombre ||
                            t("amigos.sinSectorAsignado")}
                        </p>
                        {!friend.convertido && ultimoContactoPorAmigo[friend.id] != null && diasDesde(ultimoContactoPorAmigo[friend.id]) > 21 && (
                          <p className="text-[10px] text-warning mt-0.5">{t("amigos.diasSinContacto", { count: diasDesde(ultimoContactoPorAmigo[friend.id]) })}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`censo-badge uppercase tracking-[0.08em] ${friend.convertido ? "bg-success-bg text-success" : (TONO_ESTACION[rutaActivaPorAmigo[friend.id]?.codigo] ?? "bg-surface-1 text-secondary")}`}
                    >
                      {friend.convertido
                        ? t("amigos.convertido")
                        : (rutaActivaPorAmigo[friend.id]?.nombre ?? t("amigos.sinRutaIniciada"))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {selected && (
          <aside className="card p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{t("amigos.fichaAcompanamiento")}</p>
                <h2 className="text-lg font-semibold mt-1">
                  {selected.nombres}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1.5 text-muted hover:text-ink"
                aria-label={t("amigos.cerrarFicha")}
                title={t("amigos.cerrarFicha")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveFriend} className="grid gap-3 mt-5">
              <label className="text-sm">
                {t("amigos.nombreCompleto")}
                <input
                  required
                  className="input-field mt-1.5"
                  value={editForm.nombres}
                  onChange={(event) =>
                    setEditForm({ ...editForm, nombres: event.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  {t("amigos.telefono")}
                  <input
                    className="input-field mt-1.5"
                    value={editForm.telefono}
                    onChange={(event) =>
                      setEditForm({ ...editForm, telefono: event.target.value })
                    }
                  />
                </label>
                <label className="text-sm">
                  {t("amigos.sector")}
                  <input
                    className="input-field mt-1.5"
                    value={editForm.sector}
                    onChange={(event) =>
                      setEditForm({ ...editForm, sector: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  {t("amigos.tipoTelefono")}
                  <select
                    className="input-field mt-1.5 w-full"
                    value={editForm.telefono_tipo}
                    onChange={(event) =>
                      setEditForm({ ...editForm, telefono_tipo: event.target.value })
                    }
                  >
                    <option value="">{t("amigos.sinRegistrar")}</option>
                    {Object.entries(TELEFONO_TIPO_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm mt-6">
                  <input
                    type="checkbox"
                    checked={editForm.tiene_whatsapp}
                    onChange={(event) =>
                      setEditForm({ ...editForm, tiene_whatsapp: event.target.checked })
                    }
                  />
                  {t("amigos.tieneWhatsappCorto")}
                </label>
                <label className="text-sm">
                  {t("amigos.telefonoAlterno")}
                  <input
                    className="input-field mt-1.5"
                    value={editForm.telefono_alterno}
                    onChange={(event) =>
                      setEditForm({ ...editForm, telefono_alterno: event.target.value })
                    }
                  />
                </label>
                <label className="text-sm">
                  {t("amigos.redSocial")}
                  <input
                    className="input-field mt-1.5"
                    placeholder={t("amigos.redSocialPlaceholder")}
                    value={editForm.red_social}
                    onChange={(event) =>
                      setEditForm({ ...editForm, red_social: event.target.value })
                    }
                  />
                </label>
              </div>
              <label className="text-sm">
                {t("amigos.direccion")}
                <input
                  className="input-field mt-1.5"
                  value={editForm.direccion}
                  onChange={(event) =>
                    setEditForm({ ...editForm, direccion: event.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  {t("amigos.etapa")}
                  <select
                    className="input-field mt-1.5"
                    value={editForm.etapa_id}
                    onChange={(event) =>
                      setEditForm({ ...editForm, etapa_id: event.target.value })
                    }
                  >
                    <option value="">{t("amigos.sinEtapa")}</option>
                    {etapas.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  {t("amigos.zona")}
                  <select
                    className="input-field mt-1.5"
                    value={editForm.zona_id}
                    onChange={(event) =>
                      setEditForm({ ...editForm, zona_id: event.target.value })
                    }
                  >
                    <option value="">{t("amigos.sinZona")}</option>
                    {zonas.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  {t("amigos.metodologia")}
                  <select
                    className="input-field mt-1.5"
                    value={editForm.evangelismo_metodologia_id}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        evangelismo_metodologia_id: event.target.value,
                      })
                    }
                  >
                    <option value="">{t("amigos.sinMetodologia")}</option>
                    {metodologias.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="text-sm">
                {t("amigos.invitadoPor")}
                <input
                  className="input-field mt-1.5"
                  value={editForm.invitado_por}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      invitado_por: event.target.value,
                    })
                  }
                />
              </label>
              <label className="text-sm">
                {t("amigos.primerContacto")}
                <input
                  type="date"
                  className="input-field mt-1.5"
                  value={editForm.fecha_primer_contacto}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      fecha_primer_contacto: event.target.value,
                    })
                  }
                />
              </label>
              <label className="text-sm flex items-center gap-1">
                {t("amigos.genero")}
                <InfoTip texto={t("amigos.generoTip")} />
                <select
                  className="input-field mt-1.5 w-full"
                  value={editForm.genero}
                  onChange={(event) => setEditForm({ ...editForm, genero: event.target.value })}
                >
                  <option value="">{t("amigos.sinRegistrar")}</option>
                  <option value="masculino">{t("amigos.masculino")}</option>
                  <option value="femenino">{t("amigos.femenino")}</option>
                </select>
              </label>
              <label className="text-sm flex items-center gap-1">
                {t("amigos.comiteRecibio")}
                <InfoTip texto={t("amigos.comiteRecibioTipEditar")} />
                <select
                  className="input-field mt-1.5 w-full"
                  value={editForm.comite_origen_id}
                  onChange={(event) => setEditForm({ ...editForm, comite_origen_id: event.target.value })}
                >
                  <option value="">{t("amigos.sinComiteAsignado")}</option>
                  {comites.map((comite) => (
                    <option key={comite.id} value={comite.id}>
                      {comite.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <details className="border-t border-border pt-3">
                <summary className="text-sm font-medium cursor-pointer select-none">{t("amigos.fichaSalud")}</summary>
                <p className="text-xs text-secondary mt-2">{t("amigos.fichaSaludDesc")}</p>
                <label className="flex items-center gap-2 text-sm mt-3">
                  <input type="checkbox" checked={Boolean(editForm.autorizacion_datos_salud)} onChange={(event) => setEditForm({ ...editForm, autorizacion_datos_salud: event.target.checked, fecha_autorizacion_datos_salud: event.target.checked ? (editForm.fecha_autorizacion_datos_salud || hoyBogota()) : "" })} />
                  {t("amigos.autorizaSalud")}
                  <InfoTip texto={t("amigos.autorizaSaludTip")} />
                </label>
                {editForm.autorizacion_datos_salud && <>
                  {categoriasPrioridad(editForm, calcularEdad(editForm.fecha_nacimiento)).length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{categoriasPrioridad(editForm, calcularEdad(editForm.fecha_nacimiento)).map((categoria) => <span key={categoria.key} className="text-[10px] uppercase tracking-wide bg-warning-bg text-warning rounded px-2 py-1">{categoria.label}</span>)}</div>}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <label className="text-sm">{t("amigos.tipoSangre")}<select className="input-field mt-1.5 w-full" value={editForm.tipo_sangre} onChange={(event) => setEditForm({ ...editForm, tipo_sangre: event.target.value })}><option value="">{t("amigos.sinRegistrar")}</option>{TIPO_SANGRE_OPCIONES.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select></label>
                    <label className="text-sm">{t("amigos.eps")}<input className="input-field mt-1.5" value={editForm.eps_nombre} onChange={(event) => setEditForm({ ...editForm, eps_nombre: event.target.value })} /></label>
                  </div>
                  <label className="text-sm">{t("amigos.condicionesMedicas")}<textarea className="input-field mt-1.5 min-h-16 w-full" value={editForm.condiciones_medicas} onChange={(event) => setEditForm({ ...editForm, condiciones_medicas: event.target.value })} /></label>
                  <label className="text-sm">{t("amigos.alergias")}<textarea className="input-field mt-1.5 min-h-16 w-full" value={editForm.alergias} onChange={(event) => setEditForm({ ...editForm, alergias: event.target.value })} /></label>
                  <label className="text-sm">{t("amigos.medicamentosActuales")}<InfoTip texto={t("amigos.medicamentosTip")} /><textarea className="input-field mt-1.5 min-h-16 w-full" value={editForm.medicamentos_actuales} onChange={(event) => setEditForm({ ...editForm, medicamentos_actuales: event.target.value })} /></label>
                  <label className="text-sm">{t("amigos.discapacidad")}<input className="input-field mt-1.5 w-full" placeholder={t("amigos.discapacidadPlaceholder")} value={editForm.discapacidad} onChange={(event) => setEditForm({ ...editForm, discapacidad: event.target.value })} /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-sm mt-1"><input type="checkbox" checked={Boolean(editForm.embarazada)} onChange={(event) => setEditForm({ ...editForm, embarazada: event.target.checked })} /> {t("amigos.embarazada")}</label>
                    {editForm.embarazada && <label className="text-sm">{t("amigos.fechaProbableParto")}<input type="date" className="input-field mt-1.5" value={editForm.fecha_probable_parto} onChange={(event) => setEditForm({ ...editForm, fecha_probable_parto: event.target.value })} /></label>}
                  </div>
                  <p className="text-sm font-medium mt-2">{t("amigos.contactoEmergencia")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm">{t("amigos.nombre")}<input className="input-field mt-1.5" value={editForm.contacto_emergencia_nombre} onChange={(event) => setEditForm({ ...editForm, contacto_emergencia_nombre: event.target.value })} /></label>
                    <label className="text-sm">{t("amigos.telefono")}<input className="input-field mt-1.5" value={editForm.contacto_emergencia_telefono} onChange={(event) => setEditForm({ ...editForm, contacto_emergencia_telefono: event.target.value })} /></label>
                  </div>
                  <label className="text-sm">{t("amigos.parentesco")}<input className="input-field mt-1.5" value={editForm.contacto_emergencia_parentesco} onChange={(event) => setEditForm({ ...editForm, contacto_emergencia_parentesco: event.target.value })} /></label>
                </>}
              </details>
              <details className="border-t border-border pt-3">
                <summary className="text-sm font-medium cursor-pointer select-none">{t("amigos.consentimientoDatos")}{editForm.consentimiento_datos_firma ? ` · ${t("amigos.firmado")}` : ""}</summary>
                <p className="text-xs text-secondary mt-2">{t("amigos.consentimientoDesc")}</p>
                {editForm.consentimiento_datos_firma ? <div className="mt-3">
                  <p className="text-xs text-secondary">{t("amigos.firmadoEl", { fecha: formatFecha(editForm.fecha_consentimiento_datos, { formato: formato_fecha }) })}</p>
                  <img src={editForm.consentimiento_datos_firma} alt={t("amigos.firmaAlt")} className="border border-border rounded bg-white mt-2 h-20" />
                  <div className="mt-2"><button type="button" onClick={() => setEditForm({ ...editForm, consentimiento_datos_firma: "", fecha_consentimiento_datos: "" })} className="text-xs text-danger">{t("amigos.revocarConsentimiento")}</button></div>
                </div> : mostrarFirmaEdit ? <div className="mt-3"><SignaturePad onGuardar={(firma) => { setEditForm({ ...editForm, consentimiento_datos_firma: firma, fecha_consentimiento_datos: hoyBogota() }); setMostrarFirmaEdit(false) }} onCancelar={() => setMostrarFirmaEdit(false)} /></div> : <button type="button" onClick={() => setMostrarFirmaEdit(true)} className="btn-secondary text-xs mt-3">{t("amigos.capturarFirma")}</button>}
              </details>
              <button disabled={saving} className="btn-primary justify-center">
                <Pencil className="w-4 h-4" />
                {saving ? t("amigos.guardando") : t("amigos.guardarCambios")}
              </button>
            </form>
              <section className="mt-5 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <MapPinned className="w-4 h-4 text-accent" />
                  <div>
                    <p className="eyebrow">{t("amigos.rutaEvangelistica")}</p>
                    <h3 className="font-medium text-sm mt-1 flex items-center gap-1.5">{t("amigos.estacionAcompanamiento")}<InfoTip texto={t("amigos.estacionTip")} /></h3>
                  </div>
                </div>
                {selected.comite_origen?.nombre && (
                  <p className="text-xs text-secondary mt-2 flex items-center gap-1">
                    {t("amigos.comiteRecibioLinea", { comite: "" })}<span className="font-medium text-ink">{selected.comite_origen.nombre}</span>
                    <InfoTip texto={t("amigos.comiteRecibioLineaTip")} />
                  </p>
                )}
                {routeLoading ? (
                  <p className="text-xs text-muted mt-3">{t("amigos.cargandoEstacion")}</p>
                ) : routeProcess ? (
                  <p className="text-sm text-secondary mt-3">
                    {t("amigos.estacionActualPre")}<span className="font-medium text-ink">{routeProcess.estacion?.nombre || t("amigos.sinNombre")}</span>
                    {t("amigos.estacionActualPost", { dias: diasDesde(routeProcess.fecha_inicio) ?? 0 })}
                    {RUTA_ESTACION_PATH[routeProcess.estacion?.codigo] && (
                      <Link to={RUTA_ESTACION_PATH[routeProcess.estacion.codigo]} className="text-accent">
                        {t("amigos.gestionarEn", { nombre: routeProcess.estacion?.nombre })} <ArrowRight className="inline w-3 h-3" />
                      </Link>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-secondary mt-3">
                    {t("amigos.sinEstacionIniciadaPre")}
                    <Link to="/uno-mas" className="text-accent">{t("amigos.unoMas")} <ArrowRight className="inline w-3 h-3" /></Link>
                    {t("amigos.sinEstacionIniciadaPost")}
                  </p>
                )}
                {routeHistory.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-xs font-medium text-secondary uppercase tracking-[0.08em] flex items-center gap-1.5">{t("amigos.recorridoCompleto")}<InfoTip texto={t("amigos.recorridoTip")} /></h4>
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={exportarRecorrido} className="text-xs text-accent inline-flex items-center gap-1">
                          <Download className="w-3.5 h-3.5" /> {t("amigos.exportar")}
                        </button>
                        <InfoTip texto={t("amigos.exportarTip")} />
                      </span>
                    </div>
                    <div className="mt-2.5 space-y-2.5">
                      {routeHistory.map((row) => (
                        <div key={row.id} className="flex items-start gap-2 text-xs">
                          <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.fecha_cierre ? "bg-muted" : "bg-success"}`} />
                          <div>
                            <p className="font-medium text-ink">{row.estacion?.nombre || t("amigos.sinNombre")}</p>
                            <p className="text-secondary">
                              {formatFecha(row.fecha_inicio, { formato: formato_fecha })} → {row.fecha_cierre ? formatFecha(row.fecha_cierre, { formato: formato_fecha }) : t("amigos.enCurso")}
                              {row.responsable ? ` · ${row.responsable.nombres} ${row.responsable.apellidos}` : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {comitesSugeridos.length > 0 && (
                  <p className="text-xs text-secondary mt-3 flex items-center gap-1">
                    {t("amigos.comitesSugeridos", { lista: comitesSugeridos.map((rango) => rango.comites?.nombre).filter(Boolean).join(", ") })}
                    <InfoTip texto={t("amigos.comitesSugeridosTip")} />
                  </p>
                )}
              </section>
            <div className="mt-4 grid gap-2">
              <p className="text-xs text-secondary">{t("amigos.confirmaComoApareceria")}</p>
              <label className="text-sm">{t("amigos.nombresFeligresia")}<input className="input-field mt-1.5" value={transferName.nombres} onChange={(event) => setTransferName({ ...transferName, nombres: event.target.value })} /></label>
              <label className="text-sm">{t("amigos.apellidosFeligresia")}<input className="input-field mt-1.5" value={transferName.apellidos} onChange={(event) => setTransferName({ ...transferName, apellidos: event.target.value })} /></label>
              <label className="text-sm">
                {t("amigos.fechaNacimientoFeligresia")}
                <input
                  type="date"
                  className="input-field mt-1.5"
                  value={editForm.fecha_nacimiento}
                  onChange={(event) => setEditForm({ ...editForm, fecha_nacimiento: event.target.value })}
                />
              </label>
              <label className="text-sm">
                {t("amigos.estadoCivilFeligresia")}
                <select className="input-field mt-1.5" value={editForm.estado_civil} onChange={(event) => setEditForm({ ...editForm, estado_civil: event.target.value })}>
                  <option value="soltero">{t("amigos.soltero")}</option>
                  <option value="casado">{t("amigos.casado")}</option>
                  <option value="union_libre">{t("amigos.unionLibre")}</option>
                  <option value="divorciado">{t("amigos.divorciado")}</option>
                  <option value="viudo">{t("amigos.viudo")}</option>
                </select>
              </label>
              <label className="text-sm flex items-center gap-1">
                {t("amigos.categoriaAlConvertir")}
                <InfoTip texto={t("amigos.categoriaTip")} />
                <select
                  className="input-field mt-1.5 w-full"
                  value={selected.categoria_asignada_id || ""}
                  onChange={(event) =>
                    setSelected({
                      ...selected,
                      categoria_asignada_id: event.target.value || null,
                    })
                  }
                >
                  <option value="">{t("amigos.sinCategoria")}</option>
                  {categorias.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-secondary flex items-center gap-1.5 mt-1">
                {t("amigos.hitosEspirituales")}
                <InfoTip texto={t("amigos.hitosTip")} />
              </p>
              <button
                type="button"
                disabled={saving || Boolean(selected.persona_id)}
                onClick={markBaptized}
                className="btn-secondary justify-center"
              >
                <CheckCircle2 className="w-4 h-4" />
                {selected.persona_id
                  ? t("amigos.yaEnFeligresia")
                  : selected.estado_espiritual === "bautizado"
                  ? t("amigos.volverEstadoRuta")
                  : t("amigos.marcarBautizado")}
              </button>
              {selected.estado_espiritual === "bautizado" && (
                <button type="button" disabled={saving || Boolean(selected.persona_id)} onClick={incorporateIntoFeligresia} className="btn-primary justify-center">
                  {selected.persona_id ? t("amigos.yaEnFeligresia") : t("amigos.incorporarFeligresia")}
                </button>
              )}
              {selected.estado_espiritual === "bautizado" && (
                <button type="button" onClick={descargarCertificado} className="btn-secondary justify-center">
                  <Download className="w-4 h-4" />
                  {t("amigos.descargarCertificado")}
                </button>
              )}
              <button type="button" disabled={saving || selected.sellado} onClick={markSealed} className="btn-secondary justify-center">
                <CheckCircle2 className="w-4 h-4" />
                {selected.sellado ? t("amigos.selladoEl", { fecha: selected.fecha_sellado }) : t("amigos.marcarSellado")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={removeFriend}
                className="text-xs text-danger hover:underline inline-flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("amigos.eliminarSeguimiento")}
              </button>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-accent" />
                  <h3 className="font-medium text-sm">{t("amigos.notasAcompanamiento")}</h3>
                </div>
                {!selected.convertido && (
                  <div className="flex items-center gap-2">
                    {ultimoContactoPorAmigo[selected.id] != null && (
                      <span className="text-xs text-muted flex items-center gap-1">
                        {t("amigos.diasSinContacto", { count: diasDesde(ultimoContactoPorAmigo[selected.id]) })}
                        <InfoTip texto={t("amigos.diasSinContactoTip")} />
                      </span>
                    )}
                    <button type="button" disabled={saving || !canEdit} onClick={marcarContactoHoy} className="btn-secondary text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t("amigos.marcarContactoHoy")}
                    </button>
                    <InfoTip texto={t("amigos.marcarContactoTip")} />
                  </div>
                )}
              </div>
              <form
                onSubmit={addNote}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  required
                  className="input-field"
                  placeholder={t("amigos.registrarNotaPlaceholder")}
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                />
                <button
                  disabled={saving}
                  className="btn-primary px-3 sm:w-auto"
                  aria-label={t("amigos.guardarNota")}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
              <div className="divide-y divide-border mt-3">
                {notesLoading ? (
                  <p className="text-xs text-muted py-3">{t("amigos.cargandoNotas")}</p>
                ) : notes.length ? (
                  notes.map((note) => (
                    <div key={note.id} className="py-3">
                      <p className="text-sm">{note.nota}</p>
                      <p className="text-[10px] text-muted mt-1">
                        {formatFecha(note.created_at, { formato: formato_fecha, conHora: true })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted py-3">{t("amigos.sinNotas")}</p>
                )}
              </div>
            </div>
            <FriendStageHistory history={stageHistory} loading={historyLoading} actorPorAuthId={actorPorAuthId} />
          </aside>
        )}
      </div>
    </div>
  );
}

function FriendStageHistory({ history, loading, actorPorAuthId }) {
  const { formato_fecha } = usePreferencias()
  const { t } = useTranslation()
  function describirActor(usuarioId) {
    if (!usuarioId) return t('amigos.cambioAutomatico')
    return actorPorAuthId.get(usuarioId) || t('amigos.otroUsuario')
  }
  return <section className="mt-5 border-t border-border pt-4"><div className="flex items-center justify-between gap-3"><h3 className="font-medium text-sm">{t('amigos.historialEtapas')}</h3><span className="text-[10px] text-muted">{t('amigos.cambiosCount', { count: history.length })}</span></div>{loading ? <p className="text-xs text-muted mt-3">{t('amigos.cargandoHistorial')}</p> : history.length ? <div className="divide-y divide-border mt-2">{history.map((item) => <div key={item.id} className="py-2"><p className="text-xs font-medium">{item.etapa_anterior?.nombre || t('amigos.inicio')} <span className="text-muted">→</span> {item.etapa_nueva?.nombre || t('amigos.sinEtapa')}</p><p className="text-[10px] text-muted mt-1">{formatFecha(item.creado_en, { formato: formato_fecha, conHora: true })} · {describirActor(item.usuario_id)}</p>{item.observacion && <p className="text-xs text-secondary mt-1">{item.observacion}</p>}</div>)}</div> : <p className="text-xs text-muted mt-3">{t('amigos.sinCambiosEtapa')}</p>}</section>
}

function FriendInsights({ amigos, etapas, zonas, metodologias, ultimoContactoPorAmigo }) {
  const { t } = useTranslation()
  // 21 dias (no 90 como feligresia): una relacion de ruta evangelistica es
  // mas temprana y fragil, necesita un umbral mas corto para actuar a
  // tiempo. ultimoContactoPorAmigo viene de vw_ultimo_contacto_amigos
  // (calculado a partir de notas/visitas/lecciones reales, no de un campo
  // manual) -- reemplaza el calculo anterior con fecha_primer_contacto, que
  // se fija una sola vez al crear el registro y queda "vencido" para
  // siempre en cualquier proceso de varios meses.
  const oldContactDate = fechaBogota(new Date(Date.now() - 21 * 86400000))
  const withoutRecentContact = amigos.filter((friend) => !friend.convertido && (ultimoContactoPorAmigo?.[friend.id] ?? friend.fecha_primer_contacto) < oldContactDate).length
  const sealedNotBaptized = amigos.filter((friend) => !friend.convertido && friend.sellado).length
  const countBy = (key, items) => items.map((item) => ({ ...item, total: amigos.filter((friend) => friend[key] === item.id && !friend.convertido).length })).filter((item) => item.total > 0).sort((left, right) => right.total - left.total)
  const stageTotals = countBy('etapa_id', etapas)
  const zoneTotals = countBy('zona_id', zonas)
  const methodTotals = countBy('evangelismo_metodologia_id', metodologias)
  return <section className="card p-5"><div><h2 className="font-medium">{t('amigos.lecturaRuta')}</h2><p className="text-xs text-secondary mt-1">{t('amigos.lecturaRutaDesc')}</p></div><div className="grid md:grid-cols-3 gap-4 mt-5"><InsightList title={t('amigos.porEtapa')} items={stageTotals} /><InsightList title={t('amigos.porZona')} items={zoneTotals} /><InsightList title={t('amigos.porMetodologia')} items={methodTotals} /></div>{withoutRecentContact > 0 && <p className="summary-insight mt-5">{t('amigos.sinContacto21Dias', { count: withoutRecentContact })}</p>}{sealedNotBaptized > 0 && <p className="summary-insight mt-3">{t('amigos.selladoNoBautizado', { count: sealedNotBaptized })}</p>}</section>
}

function InsightList({ title, items }) {
  const { t } = useTranslation()
  return <div><h3 className="text-sm font-medium">{title}</h3>{items.length ? items.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between gap-3 text-xs text-secondary mt-2"><span>{item.nombre}</span><strong className="text-ink">{item.total}</strong></div>) : <p className="text-xs text-muted mt-2">{t('amigos.sinDatosDisponibles')}</p>}</div>
}
