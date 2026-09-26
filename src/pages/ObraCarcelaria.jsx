import { useEffect, useState } from "react";
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
import {
  AlertTriangle,
  ArrowRightLeft,
  Church,
  HeartHandshake,
  LockKeyhole,
  Plus,
  UserCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset, paletteAt } from "../lib/chartTheme";
import { getEstacion, iniciarOMoverEstacion } from "../lib/rutaEvangelistica";
import ChartEmpty from "../components/ChartEmpty";
import Empty from "../components/Empty";
import InfoTip from "../components/InfoTip";
import ExportButtons from "../components/ExportButtons";
import Toast from "../components/Toast";
import { descargarCsv, descargarExcel, descargarPdf } from "../lib/reportExport";

ChartJS.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const obraCarcelariaCache = new Map();

const DIAS_ALERTA_INPEC = 30;
const CHART_OPTIONS = chartOptions();

const EMPTY_INTERNO = { nombres: "", apellidos: "", centro_id: "", patio: "", fecha_ingreso_ministerio: hoyBogota(), observaciones: "" };
const EMPTY_DELEGADO = { persona_id: "", centro_id: "", permiso_inpec_vigente: false, permiso_inpec_vencimiento: "", observaciones: "" };
const EMPTY_CULTO = { centro_id: "", fecha: hoyBogota(), patio: "", asistentes_total: "", estudios_biblicos_entregados: "", responsable_persona_id: "", notas: "" };
const EMPTY_FAMILIAR = { interno_id: "", familia_id: "", contacto_nombre: "", parentesco: "", telefono: "", fecha_visita: hoyBogota(), tipo_apoyo: "visita", responsable_persona_id: "", notas: "" };

function Metric({ label, value, detail, insight, progress = 0, tone = "", info }) {
  return (
    <div className="stat-tile h-full min-h-[220px] flex flex-col">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary min-h-[2rem] flex items-start gap-1.5">{label}{info && <InfoTip texto={info} />}</p>
      <p className={`text-2xl font-semibold mt-3 min-h-[2.25rem] ${tone}`}>{value}</p>
      <div className="mt-3 h-1.5 w-full rounded-full bg-surface-2 overflow-hidden flex-shrink-0" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <p className="text-xs text-muted mt-1 min-h-[1rem]">{detail || " "}</p>
      <p className="text-[11px] text-secondary leading-4 mt-2 min-h-[2rem]">{insight || " "}</p>
    </div>
  );
}


export default function ObraCarcelaria() {
  const { t } = useTranslation();
  const ESTADO_INTERNO_LABELS = { activo: t("obraCarcelaria.estadoActivo"), liberado: t("obraCarcelaria.estadoLiberado"), trasladado: t("obraCarcelaria.estadoTrasladado"), inactivo: t("obraCarcelaria.estadoInactivo") };
  const TIPO_APOYO_LABELS = { visita: t("obraCarcelaria.apoyoVisita"), consejeria: t("obraCarcelaria.apoyoConsejeria"), espiritual: t("obraCarcelaria.apoyoEspiritual"), material: t("obraCarcelaria.apoyoMaterial"), otro: t("obraCarcelaria.apoyoOtro") };
  const ESTADO_REINSERCION_LABELS = { asignado: t("obraCarcelaria.reinsercionAsignado"), contactado: t("obraCarcelaria.reinsercionContactado"), activo: t("obraCarcelaria.reinsercionActivo"), inactivo: t("obraCarcelaria.reinsercionInactivo"), reincidencia: t("obraCarcelaria.reinsercionReincidencia") };
  const PERIODOS = [["30", t("obraCarcelaria.periodo30")], ["180", t("obraCarcelaria.periodo6m")], ["365", t("obraCarcelaria.periodo12m")]];
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [tab, setTab] = useState("internos");
  const [periodo, setPeriodo] = useState("180");
  const [centros, setCentros] = useState([]);
  const [internos, setInternos] = useState([]);
  const [delegados, setDelegados] = useState([]);
  const [cultos, setCultos] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [reinserciones, setReinserciones] = useState([]);
  const [internosVinculados, setInternosVinculados] = useState(new Set());
  const [personas, setPersonas] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(null); // null = todavia no se confirma el permiso
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const [editingInternoId, setEditingInternoId] = useState(null);
  const [internoForm, setInternoForm] = useState(EMPTY_INTERNO);
  const [editingDelegadoId, setEditingDelegadoId] = useState(null);
  const [delegadoForm, setDelegadoForm] = useState(EMPTY_DELEGADO);
  const [cultoForm, setCultoForm] = useState(EMPTY_CULTO);
  const [asistenciaMarcada, setAsistenciaMarcada] = useState({});
  const [familiarForm, setFamiliarForm] = useState(EMPTY_FAMILIAR);
  const [vinculandoId, setVinculandoId] = useState(null);
  const [responsableVinculoId, setResponsableVinculoId] = useState("");

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError(t("obraCarcelaria.sinCongregacion"));
      return;
    }
    const cacheKey = `${congregacionId}:${periodo}`;
    const cached = obraCarcelariaCache.get(cacheKey);
    if (cached) {
      setCentros(cached.centros);
      setInternos(cached.internos);
      setDelegados(cached.delegados);
      setCultos(cached.cultos);
      setAsistencias(cached.asistencias);
      setSeguimientos(cached.seguimientos);
      setReinserciones(cached.reinserciones);
      setPersonas(cached.personas);
      setFamilias(cached.familias);
      setInternosVinculados(cached.internosVinculados);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const start = new Date();
    start.setDate(start.getDate() - Number(periodo));
    const [cong, cen, i, d, cu, a, sf, r, p, f, am] = await Promise.all([
      supabase.from("congregaciones").select("distrito_id").eq("id", congregacionId).single(),
      supabase.from("centros_reclusion").select("id, nombre, tipo, ciudad, activo").eq("activo", true).order("nombre"),
      supabase.from("obra_carcelaria_internos").select("id, nombres, apellidos, centro_id, patio, fecha_ingreso_ministerio, estado, bautizado, fecha_bautismo, sellado, fecha_sellado, fecha_liberacion, observaciones, centros_reclusion(nombre)").eq("congregacion_id", congregacionId).order("nombres"),
      supabase.from("obra_carcelaria_delegados").select("id, persona_id, centro_id, permiso_inpec_vigente, permiso_inpec_vencimiento, observaciones, activo, personas(nombres, apellidos), centros_reclusion(nombre)").eq("congregacion_id", congregacionId).order("created_at", { ascending: false }),
      supabase.from("obra_carcelaria_cultos").select("id, centro_id, fecha, patio, asistentes_total, estudios_biblicos_entregados, responsable_persona_id, notas, centros_reclusion(nombre)").eq("congregacion_id", congregacionId).gte("fecha", fechaBogota(start)).order("fecha", { ascending: false }),
      supabase.from("obra_carcelaria_asistencia").select("id, culto_id, interno_id, asistio, obra_carcelaria_cultos!inner(congregacion_id, fecha)").eq("obra_carcelaria_cultos.congregacion_id", congregacionId).eq("asistio", true),
      supabase.from("obra_carcelaria_seguimiento_familiar").select("id, interno_id, familia_id, contacto_nombre, parentesco, telefono, fecha_visita, tipo_apoyo, responsable_persona_id, notas, obra_carcelaria_internos(nombres, apellidos)").eq("congregacion_id", congregacionId).order("fecha_visita", { ascending: false }),
      supabase.from("obra_carcelaria_reinsercion").select("id, interno_id, congregacion_origen_id, congregacion_destino_id, fecha_asignacion, estado, notas, obra_carcelaria_internos(nombres, apellidos), origen:congregacion_origen_id(nombre), destino:congregacion_destino_id(nombre)").or(`congregacion_origen_id.eq.${congregacionId},congregacion_destino_id.eq.${congregacionId}`).order("fecha_asignacion", { ascending: false }),
      supabase.from("personas").select("id, nombres, apellidos").eq("congregacion_id", congregacionId).eq("estado_membresia", "activo").order("nombres"),
      supabase.from("familias").select("id, nombre_familia").eq("congregacion_id", congregacionId).order("nombre_familia"),
      supabase.from("amigos").select("obra_carcelaria_interno_id").eq("congregacion_id", congregacionId).not("obra_carcelaria_interno_id", "is", null),
    ]);
    const failed = [cong, cen, i, d, cu, a, sf, r, p, f, am].find((item) => item.error);
    if (failed) setError(t("obraCarcelaria.errorCargar"));
    const freshData = {
      centros: cen.data ?? [],
      internos: i.data ?? [],
      delegados: d.data ?? [],
      cultos: cu.data ?? [],
      asistencias: a.data ?? [],
      seguimientos: sf.data ?? [],
      reinserciones: r.data ?? [],
      personas: p.data ?? [],
      familias: f.data ?? [],
      internosVinculados: new Set((am.data ?? []).map((row) => row.obra_carcelaria_interno_id)),
    };
    setCentros(freshData.centros);
    setInternos(freshData.internos);
    setDelegados(freshData.delegados);
    setCultos(freshData.cultos);
    setAsistencias(freshData.asistencias);
    setSeguimientos(freshData.seguimientos);
    setReinserciones(freshData.reinserciones);
    setPersonas(freshData.personas);
    setFamilias(freshData.familias);
    setInternosVinculados(freshData.internosVinculados);
    setLoading(false);
    obraCarcelariaCache.set(cacheKey, freshData);
  }

  useEffect(() => { load(); }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "obra_carcelaria.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);

  function resetInternoForm() { setEditingInternoId(null); setInternoForm(EMPTY_INTERNO); }
  function editInterno(item) {
    setEditingInternoId(item.id);
    setInternoForm({ nombres: item.nombres, apellidos: item.apellidos, centro_id: item.centro_id || "", patio: item.patio || "", fecha_ingreso_ministerio: item.fecha_ingreso_ministerio, observaciones: item.observaciones || "" });
  }
  async function saveInterno(event) {
    event.preventDefault();
    if (!canEdit || !internoForm.nombres.trim() || !internoForm.apellidos.trim()) return;
    setSaving(true); setError(null);
    const payload = { nombres: internoForm.nombres.trim(), apellidos: internoForm.apellidos.trim(), centro_id: internoForm.centro_id || null, patio: internoForm.patio.trim() || null, fecha_ingreso_ministerio: internoForm.fecha_ingreso_ministerio, observaciones: internoForm.observaciones.trim() || null };
    const result = editingInternoId
      ? await supabase.from("obra_carcelaria_internos").update(payload).eq("id", editingInternoId)
      : await supabase.from("obra_carcelaria_internos").insert({ ...payload, congregacion_id: congregacionId });
    setSaving(false);
    if (result.error) { setError(t("obraCarcelaria.errorGuardarFicha", { mensaje: result.error.message })); return; }
    setNotice(editingInternoId ? t("obraCarcelaria.fichaActualizada") : t("obraCarcelaria.internoRegistrado")); resetInternoForm(); load();
  }
  async function marcarHito(interno, campo, fechaCampo) {
    if (!canEdit) return;
    setSaving(true); setError(null);
    const hoy = hoyBogota();
    const result = await supabase.from("obra_carcelaria_internos").update({ [campo]: true, [fechaCampo]: hoy }).eq("id", interno.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(t("obraCarcelaria.errorActualizarFicha", { mensaje: result.error.message })); return; }
    setNotice(t("obraCarcelaria.fichaActualizada")); load();
  }
  async function marcarEstado(interno, estado) {
    if (!canEdit) return;
    setSaving(true); setError(null);
    const payload = { estado, fecha_liberacion: estado === "liberado" ? hoyBogota() : interno.fecha_liberacion };
    const result = await supabase.from("obra_carcelaria_internos").update(payload).eq("id", interno.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(t("obraCarcelaria.errorActualizarEstado", { mensaje: result.error.message })); return; }
    setNotice(t("obraCarcelaria.internoMarcadoComo", { estado: ESTADO_INTERNO_LABELS[estado].toLowerCase() })); load();
  }

  function resetDelegadoForm() { setEditingDelegadoId(null); setDelegadoForm(EMPTY_DELEGADO); }
  function editDelegado(item) {
    setEditingDelegadoId(item.id);
    setDelegadoForm({ persona_id: item.persona_id, centro_id: item.centro_id || "", permiso_inpec_vigente: item.permiso_inpec_vigente, permiso_inpec_vencimiento: item.permiso_inpec_vencimiento || "", observaciones: item.observaciones || "" });
  }
  async function saveDelegado(event) {
    event.preventDefault();
    if (!canEdit || !delegadoForm.persona_id) return;
    setSaving(true); setError(null);
    const payload = { persona_id: delegadoForm.persona_id, centro_id: delegadoForm.centro_id || null, permiso_inpec_vigente: delegadoForm.permiso_inpec_vigente, permiso_inpec_vencimiento: delegadoForm.permiso_inpec_vencimiento || null, observaciones: delegadoForm.observaciones.trim() || null };
    const result = editingDelegadoId
      ? await supabase.from("obra_carcelaria_delegados").update(payload).eq("id", editingDelegadoId)
      : await supabase.from("obra_carcelaria_delegados").insert({ ...payload, congregacion_id: congregacionId });
    setSaving(false);
    if (result.error) { setError(t("obraCarcelaria.errorGuardarDelegado", { mensaje: result.error.message })); return; }
    setNotice(editingDelegadoId ? t("obraCarcelaria.delegadoActualizado") : t("obraCarcelaria.delegadoHabilitado")); resetDelegadoForm(); load();
  }

  async function createCulto(event) {
    event.preventDefault();
    if (!canEdit) return;
    const activos = internos.filter((item) => item.estado === "activo");
    setSaving(true); setError(null);
    const cultoResult = await supabase.from("obra_carcelaria_cultos").insert({
      congregacion_id: congregacionId,
      centro_id: cultoForm.centro_id || null,
      fecha: cultoForm.fecha,
      patio: cultoForm.patio.trim() || null,
      asistentes_total: Number(cultoForm.asistentes_total || 0),
      estudios_biblicos_entregados: Number(cultoForm.estudios_biblicos_entregados || 0),
      responsable_persona_id: cultoForm.responsable_persona_id || null,
      notas: cultoForm.notas.trim() || null,
    }).select("id").single();
    if (cultoResult.error) { setSaving(false); setError(t("obraCarcelaria.errorRegistrarCulto", { mensaje: cultoResult.error.message })); return; }
    if (activos.length > 0) {
      const asistResult = await supabase.from("obra_carcelaria_asistencia").insert(
        activos.map((interno) => ({ culto_id: cultoResult.data.id, interno_id: interno.id, asistio: Boolean(asistenciaMarcada[interno.id]) })),
      );
      if (asistResult.error) { setSaving(false); setError(t("obraCarcelaria.errorAsistenciaIndividual", { mensaje: asistResult.error.message })); return; }
    }
    setSaving(false);
    setNotice(t("obraCarcelaria.cultoRegistrado"));
    setCultoForm(EMPTY_CULTO); setAsistenciaMarcada({}); load();
  }

  async function saveFamiliar(event) {
    event.preventDefault();
    if (!canEdit || !familiarForm.interno_id || !familiarForm.contacto_nombre.trim()) return;
    setSaving(true); setError(null);
    const result = await supabase.from("obra_carcelaria_seguimiento_familiar").insert({
      congregacion_id: congregacionId,
      interno_id: familiarForm.interno_id,
      familia_id: familiarForm.familia_id || null,
      contacto_nombre: familiarForm.contacto_nombre.trim(),
      parentesco: familiarForm.parentesco.trim() || null,
      telefono: familiarForm.telefono.trim() || null,
      fecha_visita: familiarForm.fecha_visita,
      tipo_apoyo: familiarForm.tipo_apoyo,
      responsable_persona_id: familiarForm.responsable_persona_id || null,
      notas: familiarForm.notas.trim() || null,
    });
    setSaving(false);
    if (result.error) { setError(t("obraCarcelaria.errorRegistrarSeguimiento", { mensaje: result.error.message })); return; }
    setNotice(t("obraCarcelaria.seguimientoFamiliarRegistrado")); setFamiliarForm(EMPTY_FAMILIAR); load();
  }

  async function actualizarReinsercion(item, estado) {
    setSaving(true); setError(null);
    const result = await supabase.from("obra_carcelaria_reinsercion").update({ estado }).eq("id", item.id);
    setSaving(false);
    if (result.error) { setError(t("obraCarcelaria.errorActualizarReinsercion", { mensaje: result.error.message })); return; }
    setNotice(t("obraCarcelaria.reinsercionMarcadaComo", { estado: ESTADO_REINSERCION_LABELS[estado].toLowerCase() })); load();
  }

  // Un interno no tenia ningun siguiente paso formal una vez contactado
  // -- ni desde que se entrega estando preso, ni ya reinsertado en una
  // congregacion receptora -- esto lo conecta con el unico mecanismo
  // real de seguimiento individual que ya existe (amigos + Ruta
  // Evangelistica), sin inventar uno nuevo. Si ya se bautizo estando
  // preso, entra directo listo para incorporar a Feligresia desde
  // Amigos; si no, entra a BIS (ya fue contactado, no necesita la
  // sensibilizacion de Uno Mas) con responsable obligatorio, igual que
  // cualquier otra alta a la ruta. Sirve tanto para el ingreso inicial
  // (congregacionDestinoId = la que administra Obra Carcelaria, el
  // interno sigue preso) como para la reinsercion post-liberacion
  // (congregacionDestinoId = la congregacion receptora).
  async function vincularRutaEvangelistica(interno, congregacionDestinoId) {
    if (!interno) { setError(t("obraCarcelaria.errorSinFichaInterno")); return; }
    if (!interno.bautizado && !responsableVinculoId) { setError(t("obraCarcelaria.errorSeleccionaResponsable")); return; }
    setSaving(true); setError(null);
    const nombreCompleto = `${interno.nombres} ${interno.apellidos}`.trim();
    const { data: amigo, error: amigoError } = await supabase.from("amigos").insert({
      congregacion_id: congregacionDestinoId,
      nombres: nombreCompleto,
      fecha_primer_contacto: hoyBogota(),
      obra_carcelaria_interno_id: interno.id,
      ...(interno.bautizado ? { estado_espiritual: "bautizado", bautizado: true, fecha_bautismo: interno.fecha_bautismo } : {}),
    }).select("id").single();
    if (amigoError) { setSaving(false); setError(t("obraCarcelaria.errorVincularRuta", { mensaje: amigoError.message })); return; }
    if (interno.bautizado) {
      setSaving(false);
      setNotice(t("obraCarcelaria.vinculadoBautizado", { nombre: nombreCompleto }));
      setVinculandoId(null); setResponsableVinculoId(""); load();
      return;
    }
    const { data: estacionBis, error: estacionError } = await getEstacion(congregacionDestinoId, "bis");
    if (estacionError || !estacionBis) { setSaving(false); setError(t("obraCarcelaria.errorSinEstacionBis")); return; }
    const movResult = await iniciarOMoverEstacion({ congregacionId: congregacionDestinoId, estacionDestino: estacionBis, amigoId: amigo.id, responsablePersonaId: responsableVinculoId });
    setSaving(false);
    if (movResult.error) { setError(t("obraCarcelaria.errorAgregarBis", { mensaje: movResult.error.message })); return; }
    setNotice(t("obraCarcelaria.vinculadoBis", { nombre: nombreCompleto }));
    setVinculandoId(null); setResponsableVinculoId(""); load();
  }

  if (roleLoading || loading) return <div className="module-loading" role="status"><span className="loading-dot" />{t("obraCarcelaria.cargando")}</div>;

  const activos = internos.filter((item) => item.estado === "activo");
  const bautizados = internos.filter((item) => item.bautizado);
  const sellados = internos.filter((item) => item.sellado);
  const liberados = internos.filter((item) => item.estado === "liberado");
  const delegadosHabilitados = delegados.filter((item) => item.activo && item.permiso_inpec_vigente);
  const en30dias = fechaBogota(new Date(Date.now() + DIAS_ALERTA_INPEC * 86400000));
  const delegadosAlerta = delegados.filter((item) => item.activo && (!item.permiso_inpec_vigente || !item.permiso_inpec_vencimiento || item.permiso_inpec_vencimiento <= en30dias));

  const cultosUltimoMes = cultos.filter((item) => item.fecha >= fechaBogota(new Date(Date.now() - 30 * 86400000)));
  const estudiosUltimoMes = cultosUltimoMes.reduce((sum, item) => sum + Number(item.estudios_biblicos_entregados || 0), 0);
  const asistenciaAcumulada = cultos.reduce((sum, item) => sum + Number(item.asistentes_total || 0), 0);

  const trend = [...new Set(cultos.map((item) => item.fecha))].sort().map((fecha) => ({
    fecha,
    total: cultos.filter((item) => item.fecha === fecha).reduce((sum, item) => sum + Number(item.asistentes_total || 0), 0),
  }));
  const mitad = Math.floor(trend.length / 2) || 1;
  const primeraMitad = trend.slice(0, mitad).reduce((sum, item) => sum + item.total, 0);
  const segundaMitad = trend.slice(mitad).reduce((sum, item) => sum + item.total, 0);
  const tendenciaVariacion = trend.length >= 2 && primeraMitad ? Math.round(((segundaMitad - primeraMitad) / primeraMitad) * 100) : null;

  const ultimaVisitaPorInterno = new Map();
  seguimientos.forEach((item) => {
    const actual = ultimaVisitaPorInterno.get(item.interno_id);
    if (!actual || item.fecha_visita > actual) ultimaVisitaPorInterno.set(item.interno_id, item.fecha_visita);
  });

  // asistencias trae historial completo (sin filtro de fecha); se acota a
  // los cultos ya cargados en el periodo seleccionado para que el conteo
  // coincida con lo que el pastor ve en "Cultos y REFAM".
  const cultoIdsEnPeriodo = new Set(cultos.map((item) => item.id));
  const asistenciaPorInterno = new Map();
  asistencias.forEach((item) => {
    if (!cultoIdsEnPeriodo.has(item.culto_id)) return;
    asistenciaPorInterno.set(item.interno_id, (asistenciaPorInterno.get(item.interno_id) || 0) + 1);
  });

  const insightGeneral = activos.length
    ? `${delegadosAlerta.length > 0 ? t("obraCarcelaria.insightGeneralConAlerta", { cantidad: delegadosAlerta.length }) : t("obraCarcelaria.insightGeneralSinAlerta")}${t("obraCarcelaria.insightGeneralBautizados", { bautizados: bautizados.length, activos: activos.length })}`
    : t("obraCarcelaria.insightGeneralVacio");

  const chartData = trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: t("obraCarcelaria.asistenciaLabel") });
  const poblacionChartData = {
    labels: [t("obraCarcelaria.asistenciaAcumuladaLabel"), t("obraCarcelaria.metricBautizados"), t("obraCarcelaria.metricSellados")],
    datasets: [
      { label: t("obraCarcelaria.asistenciaPersonasCultoLabel"), data: [asistenciaAcumulada, null, null], backgroundColor: paletteAt(0).line, yAxisID: "y1" },
      { label: t("obraCarcelaria.personasLabel"), data: [null, bautizados.length, sellados.length], backgroundColor: paletteAt(1).line, yAxisID: "y" },
    ],
  };
  const POBLACION_CHART_OPTIONS = {
    ...CHART_OPTIONS,
    plugins: { ...CHART_OPTIONS.plugins, legend: { ...CHART_OPTIONS.plugins.legend, display: true, position: "top", align: "start" } },
    scales: {
      ...CHART_OPTIONS.scales,
      y: { ...CHART_OPTIONS.scales.y, position: "left", title: { display: true, text: t("obraCarcelaria.personasLabel") } },
      y1: { ...CHART_OPTIONS.scales.y, position: "right", grid: { display: false }, title: { display: true, text: t("obraCarcelaria.asistenciaAcumuladaLabel") } },
    },
  };

  function exportResumen() {
    return {
      kpis: [
        { label: t("obraCarcelaria.exportInternosActivos"), value: activos.length },
        { label: t("obraCarcelaria.exportBautizados"), value: bautizados.length },
        { label: t("obraCarcelaria.exportSellados"), value: sellados.length },
        { label: t("obraCarcelaria.exportDelegadosHabilitados"), value: delegadosHabilitados.length },
      ],
    };
  }
  function exportHeaders() {
    return {
      headers: [t("obraCarcelaria.exportColNombre"), t("obraCarcelaria.exportColCentro"), t("obraCarcelaria.exportColPatio"), t("obraCarcelaria.exportColEstado"), t("obraCarcelaria.exportColBautizado"), t("obraCarcelaria.exportColSellado"), t("obraCarcelaria.exportColUltimaVisita")],
      rows: internos.map((item) => [`${item.nombres} ${item.apellidos}`, item.centros_reclusion?.nombre || "—", item.patio || "—", ESTADO_INTERNO_LABELS[item.estado] || item.estado, item.bautizado ? t("obraCarcelaria.si") : t("obraCarcelaria.no"), item.sellado ? t("obraCarcelaria.si") : t("obraCarcelaria.no"), ultimaVisitaPorInterno.get(item.id) || t("obraCarcelaria.sinRegistro")]),
    };
  }
  function exportCsv() { descargarCsv({ filename: `obra-carcelaria-${hoyBogota()}.csv`, titulo: t("obraCarcelaria.exportTitulo"), ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `obra-carcelaria-${hoyBogota()}.xlsx`, hoja: t("obraCarcelaria.exportHoja"), titulo: t("obraCarcelaria.exportTitulo"), resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `obra-carcelaria-${hoyBogota()}.pdf`, titulo: t("obraCarcelaria.exportTitulo"), orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("obraCarcelaria.comiteEvangelismo")}</p>
          <h1 className="section-title flex items-center gap-2"><LockKeyhole className="w-6 h-6 text-accent" />{t("obraCarcelaria.titulo")}</h1>
          <p className="text-sm text-secondary mt-1">{t("obraCarcelaria.subtitulo")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5" role="group" aria-label={t("obraCarcelaria.periodoAnalisis")}>
            {PERIODOS.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPeriodo(value)} className={`text-xs px-3 py-2 rounded border ${periodo === value ? "bg-night text-white border-night" : "border-border text-secondary"}`}>{label}</button>
            ))}
          </div>
          <ExportButtons onCsv={exportCsv} onExcel={exportExcel} onPdf={exportPdf} />
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-danger bg-danger-bg rounded p-3">{error}</p>}
      {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">{t("obraCarcelaria.soloConsulta")}</p>}
      <Toast>{notice}</Toast>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label={t("obraCarcelaria.metricInternosActivos")} value={activos.length} progress={activos.length ? 100 : 0} detail={t("obraCarcelaria.detalleRegistradosTotal", { cantidad: internos.length })} insight={t("obraCarcelaria.insightPoblacionAtendida")} />
        <Metric label={t("obraCarcelaria.metricBautizados")} value={bautizados.length} progress={activos.length ? Math.round((bautizados.length / activos.length) * 100) : 0} detail={t("obraCarcelaria.detallePctActivos", { pct: activos.length ? Math.round((bautizados.length / activos.length) * 100) : 0 })} insight={t("obraCarcelaria.insightMembresiaInterna")} />
        <Metric label={t("obraCarcelaria.metricSellados")} value={sellados.length} progress={activos.length ? Math.round((sellados.length / activos.length) * 100) : 0} detail={t("obraCarcelaria.detalleConEspirituSanto")} insight={t("obraCarcelaria.insightHitoEspiritual")} />
        <Metric label={t("obraCarcelaria.metricDelegadosHabilitados")} value={delegadosHabilitados.length} tone={delegadosAlerta.length > 0 ? "text-danger" : "text-success"} progress={delegados.length ? Math.round((delegadosHabilitados.length / delegados.length) * 100) : 0} detail={t("obraCarcelaria.detallePermisoPorRevisar", { cantidad: delegadosAlerta.length })} insight={t("obraCarcelaria.insightVoluntariosAutorizados")} info={t("obraCarcelaria.infoInpec")} />
      </section>

      <p className="text-sm text-secondary bg-surface-1 rounded p-3">{insightGeneral}</p>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("obraCarcelaria.asistenciaInterna")}</p>
          <h2 className="font-medium mt-1">{t("obraCarcelaria.tendenciaAsistenciaCultos")}</h2>
          <div className="h-56 mt-4">
            {trend.length ? <Line data={chartData} options={CHART_OPTIONS} /> : <ChartEmpty message={t("obraCarcelaria.sinCultosPeriodo")} />}
          </div>
          <p className="text-xs text-secondary mt-2">{tendenciaVariacion === null ? t("obraCarcelaria.sinHistorialComparar") : (tendenciaVariacion >= 0 ? t("obraCarcelaria.crecioVariacion", { pct: Math.abs(tendenciaVariacion) }) : t("obraCarcelaria.bajoVariacion", { pct: Math.abs(tendenciaVariacion) }))}{t("obraCarcelaria.estudiosRefamEntregados", { cantidad: estudiosUltimoMes })}</p>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("obraCarcelaria.poblacionFlotanteVsMembresia")}</p>
          <h2 className="font-medium mt-1">{t("obraCarcelaria.asistenciaVsHitos")}</h2>
          <div className="h-56 mt-4">
            {cultos.length ? <Bar data={poblacionChartData} options={POBLACION_CHART_OPTIONS} /> : <ChartEmpty message={t("obraCarcelaria.sinDatosRegistrados")} />}
          </div>
        </div>
      </section>

      {delegadosAlerta.length > 0 && (
        <section className="card p-5 border-2 border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div><h2 className="font-medium">{t("obraCarcelaria.delegadosPermisoPorRevisar")}</h2><p className="text-xs text-secondary mt-1">{t("obraCarcelaria.delegadosAlertaDesc", { dias: DIAS_ALERTA_INPEC })}</p></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
            {delegadosAlerta.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-3">
                <p className="text-sm font-medium">{item.personas?.nombres} {item.personas?.apellidos}</p>
                <p className="text-xs text-secondary mt-1">{item.permiso_inpec_vencimiento ? t("obraCarcelaria.vence", { fecha: item.permiso_inpec_vencimiento }) : t("obraCarcelaria.sinFechaVencimiento")}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <nav className="flex gap-1 border-b border-border overflow-x-auto" aria-label={t("obraCarcelaria.seccionesAriaLabel")} role="tablist">
        {[["internos", t("obraCarcelaria.tabInternos"), LockKeyhole], ["cultos", t("obraCarcelaria.tabCultosRefam"), Church], ["delegados", t("obraCarcelaria.tabDelegados"), UserCheck], ["familiar", t("obraCarcelaria.tabSeguimientoFamiliar"), HeartHandshake], ["reinsercion", t("obraCarcelaria.tabReinsercion"), ArrowRightLeft]].map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === key ? "border-accent text-accent" : "border-transparent text-secondary"}`}><Icon className="w-4 h-4" />{label}</button>
        ))}
      </nav>

      {tab === "internos" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="eyebrow">{t("obraCarcelaria.censo")}</p><h2 className="font-medium mt-1 flex items-center gap-1.5">{t("obraCarcelaria.internosLabel")}<InfoTip texto={t("obraCarcelaria.internosTip")} /></h2>
            <div className="overflow-x-auto mt-4 max-h-96 overflow-y-auto">
              {internos.length ? internos.map((item) => {
                const yaVinculado = internosVinculados.has(item.id);
                const asistenciasInterno = asistenciaPorInterno.get(item.id) || 0;
                return (
                <div key={item.id} className="border-b border-border py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.nombres} {item.apellidos}</p>
                      <p className="text-xs text-secondary mt-1">{item.centros_reclusion?.nombre || t("obraCarcelaria.sinCentro")}{item.patio ? t("obraCarcelaria.patioNumero", { patio: item.patio }) : ""}</p>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-surface-1">{ESTADO_INTERNO_LABELS[item.estado]}</span>
                        {item.bautizado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">{t("obraCarcelaria.bautizadoBadge")}</span>}
                        {item.sellado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">{t("obraCarcelaria.selladoBadge")}</span>}
                        {yaVinculado && <span className="text-[11px] px-2 py-0.5 rounded bg-success-bg text-success">{t("obraCarcelaria.vinculadoALaRutaBadge")}</span>}
                        {item.estado === "activo" && cultos.length > 0 && (
                          asistenciasInterno > 0
                            ? <span className="text-[11px] px-2 py-0.5 rounded bg-surface-1">{t("obraCarcelaria.asistioACultos", { count: asistenciasInterno })}</span>
                            : <span className="text-[11px] px-2 py-0.5 rounded bg-warning-bg text-warning-dark">{t("obraCarcelaria.sinAsistenciaPeriodo")}</span>
                        )}
                      </div>
                    </div>
                    {canEdit && <button type="button" className="text-xs text-accent flex-shrink-0" onClick={() => editInterno(item)}>{t("obraCarcelaria.editar")}</button>}
                  </div>
                  {canEdit && item.estado === "activo" && (
                    <div className="flex gap-2 mt-2 flex-wrap items-start">
                      {!item.bautizado && <button type="button" className="text-xs btn-secondary px-2 py-1" onClick={() => marcarHito(item, "bautizado", "fecha_bautismo")}>{t("obraCarcelaria.marcarBautizado")}</button>}
                      {!item.sellado && <button type="button" className="text-xs btn-secondary px-2 py-1" onClick={() => marcarHito(item, "sellado", "fecha_sellado")}>{t("obraCarcelaria.marcarSellado")}</button>}
                      <button type="button" className="text-xs btn-secondary px-2 py-1" onClick={() => marcarEstado(item, "liberado")}>{t("obraCarcelaria.marcarLiberado")}</button>
                      {!yaVinculado && (
                        vinculandoId === item.id ? (
                          <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <select className="input-field text-xs py-1" value={responsableVinculoId} onChange={(event) => setResponsableVinculoId(event.target.value)}>
                              <option value="">{t("obraCarcelaria.responsableSeleccionar")}</option>
                              {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
                            </select>
                            <div className="flex gap-1.5">
                              <button type="button" disabled={saving} className="btn-primary text-xs py-1 px-2 flex-1" onClick={() => vincularRutaEvangelistica(item, congregacionId)}>{t("obraCarcelaria.confirmar")}</button>
                              <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => { setVinculandoId(null); setResponsableVinculoId(""); }}>{t("obraCarcelaria.cancelar")}</button>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <button type="button" className="text-xs btn-secondary px-2 py-1" onClick={() => (item.bautizado ? vincularRutaEvangelistica(item, congregacionId) : setVinculandoId(item.id))}>
                              {t("obraCarcelaria.vincularALaRuta")}
                            </button>
                            <InfoTip texto={t("obraCarcelaria.vincularRutaTip")} />
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>
                );
              }) : <Empty text={t("obraCarcelaria.sinInternosRegistrados")} />}
            </div>
          </div>

          {canEdit && (
            <form onSubmit={saveInterno} className="card p-5 flex flex-col gap-2 h-fit">
              <div className="flex items-center justify-between"><h2 className="font-medium">{editingInternoId ? t("obraCarcelaria.editarInterno") : t("obraCarcelaria.nuevoInterno")}</h2>{editingInternoId && <button type="button" className="text-xs text-secondary" onClick={resetInternoForm}>{t("obraCarcelaria.cancelar")}</button>}</div>
              <div className="grid grid-cols-2 gap-2">
                <input required className="input-field" placeholder={t("obraCarcelaria.placeholderNombres")} value={internoForm.nombres} onChange={(event) => setInternoForm({ ...internoForm, nombres: event.target.value })} />
                <input required className="input-field" placeholder={t("obraCarcelaria.placeholderApellidos")} value={internoForm.apellidos} onChange={(event) => setInternoForm({ ...internoForm, apellidos: event.target.value })} />
              </div>
              <select className="input-field" value={internoForm.centro_id} onChange={(event) => setInternoForm({ ...internoForm, centro_id: event.target.value })}>
                <option value="">{t("obraCarcelaria.centroReclusion")}</option>
                {centros.map((centro) => <option key={centro.id} value={centro.id}>{centro.nombre}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className="input-field" placeholder={t("obraCarcelaria.patioPabellon")} value={internoForm.patio} onChange={(event) => setInternoForm({ ...internoForm, patio: event.target.value })} />
                <input required type="date" className="input-field" value={internoForm.fecha_ingreso_ministerio} onChange={(event) => setInternoForm({ ...internoForm, fecha_ingreso_ministerio: event.target.value })} />
              </div>
              <textarea className="input-field min-h-14" placeholder={t("obraCarcelaria.observacionesPlaceholder")} value={internoForm.observaciones} onChange={(event) => setInternoForm({ ...internoForm, observaciones: event.target.value })} />
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {editingInternoId ? t("obraCarcelaria.guardarCambios") : t("obraCarcelaria.registrarInterno")}</button>
            </form>
          )}
        </section>
      )}

      {tab === "cultos" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="eyebrow">{t("obraCarcelaria.historial")}</p><h2 className="font-medium mt-1">{t("obraCarcelaria.cultosRegistrados")}</h2>
            <div className="flex flex-col divide-y divide-border mt-4 max-h-96 overflow-y-auto">
              {cultos.length ? cultos.map((item) => (
                <div key={item.id} className="py-2">
                  <div className="flex justify-between gap-3"><p className="text-sm font-medium">{item.centros_reclusion?.nombre || t("obraCarcelaria.sinCentro")}{item.patio ? t("obraCarcelaria.patioNumero", { patio: item.patio }) : ""}</p><span className="text-xs text-secondary">{item.fecha}</span></div>
                  <p className="text-xs text-secondary mt-1">{t("obraCarcelaria.asistentesYEstudios", { asistentes: item.asistentes_total, estudios: item.estudios_biblicos_entregados })}</p>
                  {item.notas && <p className="text-xs text-muted mt-1">{item.notas}</p>}
                </div>
              )) : <Empty text={t("obraCarcelaria.sinCultosRegistradosPeriodo")} />}
            </div>
          </div>

          {canEdit && (
            <form onSubmit={createCulto} className="card p-5 flex flex-col gap-2 h-fit">
              <h2 className="font-medium">{t("obraCarcelaria.registrarCulto")}</h2>
              <div className="grid grid-cols-2 gap-2">
                <select className="input-field" value={cultoForm.centro_id} onChange={(event) => setCultoForm({ ...cultoForm, centro_id: event.target.value })}>
                  <option value="">{t("obraCarcelaria.centroReclusion")}</option>
                  {centros.map((centro) => <option key={centro.id} value={centro.id}>{centro.nombre}</option>)}
                </select>
                <input required type="date" className="input-field" value={cultoForm.fecha} onChange={(event) => setCultoForm({ ...cultoForm, fecha: event.target.value })} />
              </div>
              <input className="input-field" placeholder={t("obraCarcelaria.patioPabellon")} value={cultoForm.patio} onChange={(event) => setCultoForm({ ...cultoForm, patio: event.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-secondary">{t("obraCarcelaria.asistentesTotales")}<input type="number" min="0" placeholder="0" className="input-field mt-1" value={cultoForm.asistentes_total} onChange={(event) => setCultoForm({ ...cultoForm, asistentes_total: event.target.value })} /></label>
                <label className="text-xs text-secondary flex items-center gap-1">{t("obraCarcelaria.estudiosRefamEntregadosLabel")}<InfoTip texto={t("obraCarcelaria.estudiosRefamTip")} /><input type="number" min="0" placeholder="0" className="input-field mt-1 w-full" value={cultoForm.estudios_biblicos_entregados} onChange={(event) => setCultoForm({ ...cultoForm, estudios_biblicos_entregados: event.target.value })} /></label>
              </div>
              <select className="input-field" value={cultoForm.responsable_persona_id} onChange={(event) => setCultoForm({ ...cultoForm, responsable_persona_id: event.target.value })}>
                <option value="">{t("obraCarcelaria.responsable")}</option>
                {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
              </select>
              <textarea className="input-field min-h-14" placeholder={t("obraCarcelaria.notasCultoPlaceholder")} value={cultoForm.notas} onChange={(event) => setCultoForm({ ...cultoForm, notas: event.target.value })} />
              {activos.length > 0 && <div>
                <p className="text-xs text-secondary mb-1">{t("obraCarcelaria.asistenciaIndividualInternos")}</p>
                <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                  {activos.map((interno) => <label key={interno.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[interno.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [interno.id]: event.target.checked })} />{interno.nombres} {interno.apellidos}</label>)}
                </div>
              </div>}
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {t("obraCarcelaria.registrarCulto")}</button>
            </form>
          )}
        </section>
      )}

      {tab === "delegados" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border"><p className="eyebrow">{t("obraCarcelaria.habilitacionVoluntarios")}</p><h2 className="font-medium mt-1">{t("obraCarcelaria.delegadosLabel")}</h2></div>
            {delegados.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">{t("obraCarcelaria.colDelegado")}</th><th className="font-normal px-4 py-2.5">{t("obraCarcelaria.colCentro")}</th><th className="font-normal px-4 py-2.5">{t("obraCarcelaria.colPermisoInpec")}</th><th className="font-normal px-4 py-2.5"></th></tr></thead>
                  <tbody>
                    {delegados.map((item) => {
                      const vencido = !item.permiso_inpec_vigente || !item.permiso_inpec_vencimiento || item.permiso_inpec_vencimiento <= en30dias;
                      return (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-4 py-2.5 font-medium">{item.personas?.nombres} {item.personas?.apellidos}</td>
                          <td className="px-4 py-2.5 text-secondary">{item.centros_reclusion?.nombre || "—"}</td>
                          <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${vencido ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>{item.permiso_inpec_vencimiento ? t("obraCarcelaria.venceFecha", { fecha: item.permiso_inpec_vencimiento }) : t("obraCarcelaria.sinFecha")}</span></td>
                          <td className="px-4 py-2.5 text-right">{canEdit && <button type="button" className="text-xs text-accent" onClick={() => editDelegado(item)}>{t("obraCarcelaria.editar")}</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <Empty text={t("obraCarcelaria.sinDelegadosRegistrados")} illustration="equipo" />}
          </div>

          {canEdit && (
            <form onSubmit={saveDelegado} className="card p-5 flex flex-col gap-2 h-fit">
              <div className="flex items-center justify-between"><h2 className="font-medium">{editingDelegadoId ? t("obraCarcelaria.editarDelegado") : t("obraCarcelaria.nuevoDelegado")}</h2>{editingDelegadoId && <button type="button" className="text-xs text-secondary" onClick={resetDelegadoForm}>{t("obraCarcelaria.cancelar")}</button>}</div>
              <select required className="input-field" value={delegadoForm.persona_id} onChange={(event) => setDelegadoForm({ ...delegadoForm, persona_id: event.target.value })}>
                <option value="">{t("obraCarcelaria.persona")}</option>
                {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
              </select>
              <select className="input-field" value={delegadoForm.centro_id} onChange={(event) => setDelegadoForm({ ...delegadoForm, centro_id: event.target.value })}>
                <option value="">{t("obraCarcelaria.centroReclusion")}</option>
                {centros.map((centro) => <option key={centro.id} value={centro.id}>{centro.nombre}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={delegadoForm.permiso_inpec_vigente} onChange={(event) => setDelegadoForm({ ...delegadoForm, permiso_inpec_vigente: event.target.checked })} />{t("obraCarcelaria.permisoInpecVigente")}<InfoTip texto={t("obraCarcelaria.permisoInpecTip")} /></label>
              <label className="text-xs text-secondary">{t("obraCarcelaria.vencimientoPermiso")}<input type="date" className="input-field mt-1" value={delegadoForm.permiso_inpec_vencimiento} onChange={(event) => setDelegadoForm({ ...delegadoForm, permiso_inpec_vencimiento: event.target.value })} /></label>
              <textarea className="input-field min-h-14" placeholder={t("obraCarcelaria.observacionesDelegadoPlaceholder")} value={delegadoForm.observaciones} onChange={(event) => setDelegadoForm({ ...delegadoForm, observaciones: event.target.value })} />
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {editingDelegadoId ? t("obraCarcelaria.guardarCambios") : t("obraCarcelaria.habilitarDelegado")}</button>
            </form>
          )}
        </section>
      )}

      {tab === "familiar" && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="eyebrow">{t("obraCarcelaria.asistenciaExterna")}</p><h2 className="font-medium mt-1">{t("obraCarcelaria.seguimientoFamiliar")}</h2>
            <div className="flex flex-col divide-y divide-border mt-4 max-h-96 overflow-y-auto">
              {seguimientos.length ? seguimientos.map((item) => (
                <div key={item.id} className="py-2">
                  <div className="flex justify-between gap-3"><p className="text-sm font-medium">{item.obra_carcelaria_internos?.nombres} {item.obra_carcelaria_internos?.apellidos}</p><span className="text-xs text-secondary">{item.fecha_visita}</span></div>
                  <p className="text-xs text-secondary mt-1">{TIPO_APOYO_LABELS[item.tipo_apoyo]} · {item.contacto_nombre}{item.parentesco ? ` (${item.parentesco})` : ""}</p>
                  {item.notas && <p className="text-xs text-muted mt-1">{item.notas}</p>}
                </div>
              )) : <Empty text={t("obraCarcelaria.sinSeguimientoRegistrado")} />}
            </div>
          </div>

          {canEdit && (
            <form onSubmit={saveFamiliar} className="card p-5 flex flex-col gap-2 h-fit">
              <h2 className="font-medium">{t("obraCarcelaria.registrarSeguimientoFamiliar")}</h2>
              <select required className="input-field" value={familiarForm.interno_id} onChange={(event) => setFamiliarForm({ ...familiarForm, interno_id: event.target.value })}>
                <option value="">{t("obraCarcelaria.interno")}</option>
                {internos.map((interno) => <option key={interno.id} value={interno.id}>{interno.nombres} {interno.apellidos}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input required className="input-field" placeholder={t("obraCarcelaria.contactoPlaceholder")} value={familiarForm.contacto_nombre} onChange={(event) => setFamiliarForm({ ...familiarForm, contacto_nombre: event.target.value })} />
                <input className="input-field" placeholder={t("obraCarcelaria.parentescoPlaceholder")} value={familiarForm.parentesco} onChange={(event) => setFamiliarForm({ ...familiarForm, parentesco: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input-field" placeholder={t("obraCarcelaria.telefonoPlaceholder")} value={familiarForm.telefono} onChange={(event) => setFamiliarForm({ ...familiarForm, telefono: event.target.value })} />
                <input required type="date" className="input-field" value={familiarForm.fecha_visita} onChange={(event) => setFamiliarForm({ ...familiarForm, fecha_visita: event.target.value })} />
              </div>
              <select className="input-field" value={familiarForm.tipo_apoyo} onChange={(event) => setFamiliarForm({ ...familiarForm, tipo_apoyo: event.target.value })}>
                {Object.entries(TIPO_APOYO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select className="input-field" value={familiarForm.familia_id} onChange={(event) => setFamiliarForm({ ...familiarForm, familia_id: event.target.value })}>
                <option value="">{t("obraCarcelaria.vincularFamiliaOpcional")}</option>
                {familias.map((familia) => <option key={familia.id} value={familia.id}>{familia.nombre_familia}</option>)}
              </select>
              <select className="input-field" value={familiarForm.responsable_persona_id} onChange={(event) => setFamiliarForm({ ...familiarForm, responsable_persona_id: event.target.value })}>
                <option value="">{t("obraCarcelaria.responsable")}</option>
                {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
              </select>
              <textarea className="input-field min-h-14" placeholder={t("obraCarcelaria.notasFamiliarPlaceholder")} value={familiarForm.notas} onChange={(event) => setFamiliarForm({ ...familiarForm, notas: event.target.value })} />
              <button disabled={saving} className="btn-primary justify-center"><Plus className="w-4 h-4" /> {t("obraCarcelaria.registrarSeguimiento")}</button>
            </form>
          )}
        </section>
      )}

      {tab === "reinsercion" && (
        <section className="card overflow-hidden">
          <div className="p-5 border-b border-border"><p className="eyebrow">{t("obraCarcelaria.postPenitenciario")}</p><h2 className="font-medium mt-1">{t("obraCarcelaria.reinsercionEclesial")}</h2><p className="text-sm text-secondary mt-1">{t("obraCarcelaria.reinsercionDesc")}</p></div>
          {reinserciones.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted bg-surface-1"><th className="font-normal px-4 py-2.5">{t("obraCarcelaria.colInterno")}</th><th className="font-normal px-4 py-2.5">{t("obraCarcelaria.colOrigen")}</th><th className="font-normal px-4 py-2.5">{t("obraCarcelaria.colDestino")}</th><th className="font-normal px-4 py-2.5">{t("obraCarcelaria.colEstado")}</th><th className="font-normal px-4 py-2.5"><span className="inline-flex items-center gap-1">{t("obraCarcelaria.colRutaEvangelistica")}<InfoTip texto={t("obraCarcelaria.rutaEvangelisticaTip")} /></span></th></tr></thead>
                <tbody>
                  {reinserciones.map((item) => {
                    const interno = internos.find((row) => row.id === item.interno_id);
                    const yaVinculado = internosVinculados.has(item.interno_id);
                    const puedeVincular = canEdit && item.congregacion_destino_id === congregacionId && item.estado !== "asignado" && !yaVinculado;
                    return (
                      <tr key={item.id} className="border-t border-border align-top">
                        <td className="px-4 py-2.5 font-medium">{item.obra_carcelaria_internos?.nombres} {item.obra_carcelaria_internos?.apellidos}</td>
                        <td className="px-4 py-2.5 text-secondary">{item.origen?.nombre}</td>
                        <td className="px-4 py-2.5 text-secondary">{item.destino?.nombre}</td>
                        <td className="px-4 py-2.5">
                          {canEdit && item.congregacion_destino_id === congregacionId ? (
                            <select className="input-field text-xs py-1" value={item.estado} onChange={(event) => actualizarReinsercion(item, event.target.value)}>
                              {Object.entries(ESTADO_REINSERCION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          ) : <span className="text-xs px-2 py-1 rounded bg-surface-1">{ESTADO_REINSERCION_LABELS[item.estado]}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {yaVinculado ? <span className="text-xs text-success">{t("obraCarcelaria.vinculado")}</span> : puedeVincular ? (
                            vinculandoId === item.id ? (
                              <div className="flex flex-col gap-1.5 min-w-[180px]">
                                <select className="input-field text-xs py-1" value={responsableVinculoId} onChange={(event) => setResponsableVinculoId(event.target.value)}>
                                  <option value="">{t("obraCarcelaria.responsableSeleccionar")}</option>
                                  {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
                                </select>
                                <div className="flex gap-1.5">
                                  <button type="button" disabled={saving} className="btn-primary text-xs py-1 px-2 flex-1" onClick={() => vincularRutaEvangelistica(interno, item.congregacion_destino_id)}>{t("obraCarcelaria.confirmar")}</button>
                                  <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => { setVinculandoId(null); setResponsableVinculoId(""); }}>{t("obraCarcelaria.cancelar")}</button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => (interno?.bautizado ? vincularRutaEvangelistica(interno, item.congregacion_destino_id) : setVinculandoId(item.id))}>
                                {t("obraCarcelaria.vincular")}
                              </button>
                            )
                          ) : <span className="text-xs text-muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="p-5 text-sm text-muted">{liberados.length > 0 ? t("obraCarcelaria.hayInternosLiberadosSinAsignacion") : t("obraCarcelaria.sinCasosReinsercion")}</p>}
        </section>
      )}
    </div>
  );
}
