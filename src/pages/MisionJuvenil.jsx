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
import { BookOpen, Building2, Plus, Target, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { hoyBogota, fechaBogota } from "../lib/fechaBogota";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import { getEstacion, iniciarOMoverEstacion } from "../lib/rutaEvangelistica";
import Pager from "../components/Pager";
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

const misionJuvenilCache = new Map();

function Metric({ label, value, detail, insight, progress = 0, tone = "", info }) {
  return (
    <div className="stat-tile h-full min-h-[220px] flex flex-col">
      <p className="text-[10px] uppercase tracking-[0.14em] text-secondary min-h-[2rem] flex items-start gap-1.5">
        {label}
        {info && <InfoTip texto={info} />}
      </p>
      <p className={`text-2xl font-semibold mt-3 min-h-[2.25rem] ${tone}`}>{value}</p>
      <div className="mt-3 h-1.5 w-full rounded-full bg-surface-2 overflow-hidden flex-shrink-0" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <p className="text-xs text-muted mt-1 min-h-[1rem]">{detail || " "}</p>
      <p className="text-[11px] text-secondary leading-4 mt-2 min-h-[2rem]">{insight || " "}</p>
    </div>
  );
}

export default function MisionJuvenil() {
  const { t } = useTranslation();
  const PERIODOS = [
    ["30", t("misionJuvenil.periodo30")],
    ["180", t("misionJuvenil.periodo6m")],
    ["365", t("misionJuvenil.periodo12m")],
  ];
  const FASES = {
    1: t("misionJuvenil.fase1"),
    2: t("misionJuvenil.fase2"),
    3: t("misionJuvenil.fase3"),
  };
  const ESTADOS = {
    simpatizante: t("misionJuvenil.estadoSimpatizante"),
    refam: t("misionJuvenil.estadoRefam"),
    discipulado: t("misionJuvenil.estadoDiscipulado"),
    bautizado: t("misionJuvenil.estadoBautizado"),
    inactivo: t("misionJuvenil.estadoInactivo"),
  };
  const TIPO_INSTITUCION_LABELS = { publica: t("misionJuvenil.tipoPublica"), privada: t("misionJuvenil.tipoPrivada") };
  const NIVEL_INSTITUCION_LABELS = { bachillerato: t("misionJuvenil.nivelBachillerato"), universidad: t("misionJuvenil.nivelUniversidad"), otro: t("misionJuvenil.nivelOtro") };
  const { rolPrincipal, loading: roleLoading } = useMiRol();
  const congregacionId = rolPrincipal?.congregacion_id;
  const [instituciones, setInstituciones] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [periodo, setPeriodo] = useState("180");
  const [institucionFiltro, setInstitucionFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
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
  const [institutionForm, setInstitutionForm] = useState({
    nombre: "",
    tipo: "publica",
    nivel: "bachillerato",
    direccion: "",
    contacto_nombre: "",
    contacto_cargo: "",
    contacto_telefono: "",
    fase: 1,
  });
  const [studentForm, setStudentForm] = useState({
    nombres: "",
    apellidos: "",
    institucion_id: "",
    grado_semestre: "",
    telefono: "",
    estado: "simpatizante",
    tutor_persona_id: "",
  });
  const [groupForm, setGroupForm] = useState({
    nombre: "",
    institucion_id: "",
    direccion: "",
    lider_persona_id: "",
    leccion_actual: "",
  });
  const [selectedGrupoId, setSelectedGrupoId] = useState(null);
  const [lecciones, setLecciones] = useState([]);
  const [leccionForm, setLeccionForm] = useState({ tema: "", fecha: hoyBogota(), notas: "" });
  const [asistenciaMarcada, setAsistenciaMarcada] = useState({});
  const [lideres, setLideres] = useState([]);
  const [liderForm, setLiderForm] = useState({ persona_id: "", rol: "gestor" });
  const [studentsPage, setStudentsPage] = useState(0);
  const [estudiantesVinculados, setEstudiantesVinculados] = useState(new Set());
  const [vinculandoId, setVinculandoId] = useState(null);
  const [responsableVinculoId, setResponsableVinculoId] = useState("");

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError(t("misionJuvenil.sinCongregacion"));
      return;
    }
    const cacheKey = `${congregacionId}:${periodo}`;
    const cached = misionJuvenilCache.get(cacheKey);
    if (cached) {
      setInstituciones(cached.instituciones);
      setEstudiantes(cached.estudiantes);
      setGrupos(cached.grupos);
      setRegistros(cached.registros);
      setPersonas(cached.personas);
      setLideres(cached.lideres);
      setEstudiantesVinculados(cached.estudiantesVinculados);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const start = new Date();
    start.setDate(start.getDate() - Number(periodo));
    const [i, s, g, r, p, l, am] = await Promise.all([
      supabase
        .from("mision_instituciones")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .order("nombre"),
      supabase
        .from("mision_estudiantes")
        .select(
          "id, nombres, apellidos, institucion_id, grado_semestre, telefono, estado, tutor_persona_id, bautizado, fecha_bautismo, sellado, fecha_sellado, mision_instituciones(nombre)",
        )
        .eq("congregacion_id", congregacionId)
        .order("nombres")
        .order("apellidos"),
      supabase
        .from("mision_grupos")
        .select(
          "id, nombre, institucion_id, direccion, lider_persona_id, leccion_actual, lecciones_total, mision_instituciones(nombre), personas:lider_persona_id(nombres, apellidos)",
        )
        .eq("congregacion_id", congregacionId)
        .order("nombre"),
      supabase
        .from("registros_actividad")
        .select(
          "id, fecha, total_asistentes, modulo_id, modulos!inner(nombre_modulo)",
        )
        .eq("congregacion_id", congregacionId)
        .ilike("modulos.nombre_modulo", "Mision Juvenil")
        .gte("fecha", fechaBogota(start))
        .order("fecha"),
      supabase
        .from("personas")
        .select("id, nombres, apellidos")
        .eq("congregacion_id", congregacionId)
        .eq("estado_membresia", "activo")
        .order("nombres"),
      supabase
        .from("mision_lideres")
        .select("id, persona_id, rol, activo, personas(nombres, apellidos)")
        .eq("congregacion_id", congregacionId)
        .order("created_at", { ascending: false }),
      supabase
        .from("amigos")
        .select("mision_juvenil_estudiante_id")
        .eq("congregacion_id", congregacionId)
        .not("mision_juvenil_estudiante_id", "is", null),
    ]);
    const failed = [i, s, g, r, p, l, am].find((item) => item.error);
    if (failed)
      setError(t("misionJuvenil.errorCargar"));
    const freshData = {
      instituciones: i.data ?? [],
      estudiantes: s.data ?? [],
      grupos: g.data ?? [],
      registros: r.data ?? [],
      personas: p.data ?? [],
      lideres: l.data ?? [],
      estudiantesVinculados: new Set((am.data ?? []).map((row) => row.mision_juvenil_estudiante_id)),
    };
    setInstituciones(freshData.instituciones);
    setEstudiantes(freshData.estudiantes);
    setGrupos(freshData.grupos);
    setRegistros(freshData.registros);
    setPersonas(freshData.personas);
    setLideres(freshData.lideres);
    setEstudiantesVinculados(freshData.estudiantesVinculados);
    setLoading(false);
    misionJuvenilCache.set(cacheKey, freshData);
  }

  async function loadLecciones(grupoId) {
    setSelectedGrupoId(grupoId);
    setLecciones([]);
    setAsistenciaMarcada({});
    if (!grupoId) return;
    const { data, error: leccionesError } = await supabase
      .from("mision_lecciones")
      .select("id, numero, tema, fecha, asistentes, notas")
      .eq("grupo_id", grupoId)
      .order("numero", { ascending: false });
    if (leccionesError) setError(t("misionJuvenil.errorHistorialLecciones"));
    setLecciones(data ?? []);
  }

  async function createLeccion(event) {
    event.preventDefault();
    if (!canEdit || !selectedGrupoId) return;
    const grupo = grupos.find((item) => item.id === selectedGrupoId);
    const estudiantesGrupo = estudiantes.filter((estudiante) => estudiante.institucion_id === grupo?.institucion_id);
    const asistentesCount = estudiantesGrupo.filter((estudiante) => asistenciaMarcada[estudiante.id]).length;
    setSaving(true);
    setError(null);
    const proximoNumero = (lecciones[0]?.numero || 0) + 1;
    const leccionResult = await supabase.from("mision_lecciones").insert({
      grupo_id: selectedGrupoId,
      numero: proximoNumero,
      tema: leccionForm.tema.trim(),
      fecha: leccionForm.fecha,
      asistentes: asistentesCount,
      notas: leccionForm.notas.trim() || null,
    }).select("id").single();
    if (leccionResult.error) {
      setSaving(false);
      setError(t("misionJuvenil.errorRegistrarLeccion", { mensaje: leccionResult.error.message }));
      return;
    }
    if (estudiantesGrupo.length > 0) {
      const asistenciaResult = await supabase.from("mision_asistencia_estudiante").insert(
        estudiantesGrupo.map((estudiante) => ({ leccion_id: leccionResult.data.id, estudiante_id: estudiante.id, asistio: Boolean(asistenciaMarcada[estudiante.id]) })),
      );
      if (asistenciaResult.error) { setSaving(false); setError(t("misionJuvenil.errorAsistenciaIndividual", { mensaje: asistenciaResult.error.message })); return; }
    }
    if (proximoNumero > (grupo?.leccion_actual || 0)) {
      await supabase.from("mision_grupos").update({ leccion_actual: proximoNumero }).eq("id", selectedGrupoId).eq("congregacion_id", congregacionId);
    }
    setSaving(false);
    setNotice(t("misionJuvenil.leccionRegistrada"));
    setLeccionForm({ tema: "", fecha: hoyBogota(), notas: "" });
    setAsistenciaMarcada({});
    loadLecciones(selectedGrupoId);
    load();
  }

  async function createLider(event) {
    event.preventDefault();
    if (!canEdit || !liderForm.persona_id) return;
    setSaving(true);
    setError(null);
    const result = await supabase.from("mision_lideres").insert({ congregacion_id: congregacionId, persona_id: liderForm.persona_id, rol: liderForm.rol.trim() || "gestor" });
    setSaving(false);
    if (result.error) {
      setError(result.error.code === "23505" ? t("misionJuvenil.errorPersonaYaLider") : t("misionJuvenil.errorRegistrarLider", { mensaje: result.error.message }));
      return;
    }
    setNotice(t("misionJuvenil.liderRegistrado"));
    setLiderForm({ persona_id: "", rol: "gestor" });
    load();
  }

  async function toggleLider(lider) {
    const result = await supabase.from("mision_lideres").update({ activo: lider.activo === false }).eq("id", lider.id).eq("congregacion_id", congregacionId);
    if (result.error) { setError(t("misionJuvenil.errorEstadoLider", { mensaje: result.error.message })); return; }
    load();
  }
  useEffect(() => {
    load();
  }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    const roleCanEdit = rolPrincipal?.nivel === "local" && rolPrincipal?.rol_local !== "solo_lectura";
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "mision_juvenil.editar" }).then(({ data }) => setCanEdit(roleCanEdit || Boolean(data)));
  }, [congregacionId, rolPrincipal]);
  useEffect(() => { setStudentsPage(0); }, [institucionFiltro, estadoFiltro]);
  const students = estudiantes.filter(
    (student) =>
      (institucionFiltro === "todos" ||
        student.institucion_id === institucionFiltro) &&
      (estadoFiltro === "todos" || student.estado === estadoFiltro),
  );
  const STUDENTS_PAGE_SIZE = 50;
  const studentsPageCount = Math.max(1, Math.ceil(students.length / STUDENTS_PAGE_SIZE));
  const studentsPageSafe = Math.min(studentsPage, studentsPageCount - 1);
  const studentsPageItems = students.slice(studentsPageSafe * STUDENTS_PAGE_SIZE, studentsPageSafe * STUDENTS_PAGE_SIZE + STUDENTS_PAGE_SIZE);
  const visibleRecords = registros;
  const attendance = visibleRecords.reduce(
    (sum, item) => sum + Number(item.total_asistentes || 0),
    0,
  );
  const average = visibleRecords.length
    ? Math.round(attendance / visibleRecords.length)
    : 0;
  const baptized = students.filter((student) => student.bautizado).length;
  const sealed = students.filter((student) => student.sellado).length;
  const activeSympathizers = students.filter((student) =>
    ["simpatizante", "refam", "discipulado"].includes(student.estado),
  ).length;
  const activeStudents = students.filter((student) => student.estado !== "inactivo").length;
  const activeGroups = grupos.filter(
    (group) =>
      group.activo !== false &&
      (institucionFiltro === "todos" || group.institucion_id === institucionFiltro),
  ).length;
  const establishedInstitutions = instituciones.filter((institution) => institution.fase === 3).length;
  const studentsPerGroup = activeGroups ? Math.round(students.length / activeGroups) : 0;
  const baptismRate = activeStudents ? Math.round((baptized / activeStudents) * 100) : 0;
  const attendanceRate = students.length ? Math.min(100, Math.round((average / students.length) * 100)) : 0;
  const institutionRows = instituciones
    .map((institution) => ({
      ...institution,
      estudiantes: estudiantes.filter(
        (student) => student.institucion_id === institution.id,
      ).length,
      grupos: grupos.filter((group) => group.institucion_id === institution.id)
        .length,
    }))
    .sort((a, b) => b.estudiantes - a.estudiantes);
  const statusRows = Object.entries(ESTADOS).map(([key, label]) => ({
    label,
    total: students.filter((student) => student.estado === key).length,
  }));
  const trend = [...new Set(registros.map((record) => record.fecha))]
    .sort()
    .map((fecha) => ({
      fecha,
      total: registros
        .filter((record) => record.fecha === fecha)
        .reduce((sum, item) => sum + Number(item.total_asistentes || 0), 0),
    }));
  const topInstitution = institutionRows[0];
  const insight = topInstitution?.estudiantes
    ? t("misionJuvenil.insightTopInstitucion", { nombre: topInstitution.nombre, cantidad: topInstitution.estudiantes })
    : t("misionJuvenil.insightSinDatos");

  function exportResumen() {
    return {
      kpis: [
        { label: t("misionJuvenil.exportEstudiantesActivos"), value: activeStudents },
        { label: t("misionJuvenil.exportGruposActivos"), value: activeGroups },
        { label: t("misionJuvenil.exportBautizados"), value: baptized },
        { label: t("misionJuvenil.exportSellados"), value: sealed },
      ],
      desgloses: [{ titulo: t("misionJuvenil.exportEstudiantesPorEstado"), items: statusRows.map((item) => ({ label: item.label, valor: item.total })) }],
    };
  }
  function exportHeaders() {
    return {
      headers: [t("misionJuvenil.exportColInstitucion"), t("misionJuvenil.exportColEstudiantes"), t("misionJuvenil.exportColGrupos"), t("misionJuvenil.exportColFase")],
      rows: institutionRows.map((item) => [item.nombre, item.estudiantes, item.grupos, item.fase === 3 ? t("misionJuvenil.exportEstablecida") : t("misionJuvenil.exportFaseGuion", { fase: item.fase ?? "—" })]),
    };
  }
  function exportCsv() { descargarCsv({ filename: `mision-juvenil-${hoyBogota()}.csv`, titulo: t("misionJuvenil.exportTitulo"), ...exportHeaders() }); }
  function exportExcel() { descargarExcel({ filename: `mision-juvenil-${hoyBogota()}.xlsx`, hoja: t("misionJuvenil.exportHoja"), titulo: t("misionJuvenil.exportTitulo"), resumen: exportResumen(), ...exportHeaders() }); }
  function exportPdf() { descargarPdf({ filename: `mision-juvenil-${hoyBogota()}.pdf`, titulo: t("misionJuvenil.exportTitulo"), orientacion: "landscape", resumen: exportResumen(), ...exportHeaders() }); }

  async function createInstitution(event) {
    event.preventDefault();
    setSaving(true);
    const result = await supabase
      .from("mision_instituciones")
      .insert({
        ...institutionForm,
        congregacion_id: congregacionId,
        fase: Number(institutionForm.fase),
      });
    setSaving(false);
    if (result.error)
      setError(t("misionJuvenil.errorRegistrarInstitucion"));
    else {
      setNotice(t("misionJuvenil.institucionRegistrada"));
      setInstitutionForm({
        nombre: "",
        tipo: "publica",
        nivel: "bachillerato",
        direccion: "",
        contacto_nombre: "",
        contacto_cargo: "",
        contacto_telefono: "",
        fase: 1,
      });
      load();
    }
  }
  async function marcarHitoEstudiante(student, campo, fechaCampo) {
    if (!canEdit) return;
    setSaving(true);
    const hoy = hoyBogota();
    const result = await supabase.from("mision_estudiantes").update({ [campo]: true, [fechaCampo]: hoy }).eq("id", student.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(t("misionJuvenil.errorActualizarFicha", { mensaje: result.error.message })); return; }
    setNotice(t("misionJuvenil.fichaActualizada"));
    load();
  }

  // Un estudiante de Mision Juvenil no tenia ningun siguiente paso una vez
  // convertido -- esto lo conecta con el unico mecanismo real de
  // seguimiento individual que ya existe (amigos + Ruta Evangelistica),
  // igual que ya se hizo con Obra Carcelaria. El estado interno de Mision
  // Juvenil (simpatizante/refam/discipulado/etc.) no mapea 1:1 con las
  // estaciones de la Ruta, asi que siempre entra por BIS ("ya fue
  // contactado, no necesita la sensibilizacion de Uno Mas") salvo que ya
  // este bautizado, en cuyo caso queda listo para incorporar a Feligresia.
  async function vincularRutaEvangelistica(student) {
    if (!canEdit) return;
    if (!student.bautizado && !responsableVinculoId) { setError(t("misionJuvenil.errorSeleccionaResponsable")); return; }
    setSaving(true); setError(null);
    const nombreCompleto = `${student.nombres} ${student.apellidos}`.trim();
    const { data: amigo, error: amigoError } = await supabase.from("amigos").insert({
      congregacion_id: congregacionId,
      nombres: nombreCompleto,
      fecha_primer_contacto: hoyBogota(),
      mision_juvenil_estudiante_id: student.id,
      ...(student.bautizado ? { estado_espiritual: "bautizado", bautizado: true, fecha_bautismo: student.fecha_bautismo } : {}),
    }).select("id").single();
    if (amigoError) { setSaving(false); setError(t("misionJuvenil.errorVincularRuta", { mensaje: amigoError.message })); return; }
    if (student.bautizado) {
      setSaving(false);
      setNotice(t("misionJuvenil.vinculadoBautizado", { nombre: nombreCompleto }));
      setVinculandoId(null); setResponsableVinculoId(""); load();
      return;
    }
    const { data: estacionBis, error: estacionError } = await getEstacion(congregacionId, "bis");
    if (estacionError || !estacionBis) { setSaving(false); setError(t("misionJuvenil.errorSinEstacionBis")); return; }
    const movResult = await iniciarOMoverEstacion({ congregacionId, estacionDestino: estacionBis, amigoId: amigo.id, responsablePersonaId: responsableVinculoId });
    setSaving(false);
    if (movResult.error) { setError(t("misionJuvenil.errorAgregarBis", { mensaje: movResult.error.message })); return; }
    setNotice(t("misionJuvenil.vinculadoBis", { nombre: nombreCompleto }));
    setVinculandoId(null); setResponsableVinculoId(""); load();
  }

  async function createStudent(event) {
    event.preventDefault();
    setSaving(true);
    const result = await supabase
      .from("mision_estudiantes")
      .insert({
        ...studentForm,
        congregacion_id: congregacionId,
        institucion_id: studentForm.institucion_id || null,
        tutor_persona_id: studentForm.tutor_persona_id || null,
      });
    setSaving(false);
    if (result.error)
      setError(t("misionJuvenil.errorRegistrarEstudiante"));
    else {
      setNotice(t("misionJuvenil.estudianteRegistrado"));
      setStudentForm({
        nombres: "",
        apellidos: "",
        institucion_id: "",
        grado_semestre: "",
        telefono: "",
        estado: "simpatizante",
        tutor_persona_id: "",
      });
      load();
    }
  }
  async function createGroup(event) {
    event.preventDefault();
    setSaving(true);
    const result = await supabase
      .from("mision_grupos")
      .insert({
        ...groupForm,
        congregacion_id: congregacionId,
        institucion_id: groupForm.institucion_id || null,
        lider_persona_id: groupForm.lider_persona_id || null,
        leccion_actual: Number(groupForm.leccion_actual) || 1,
      });
    setSaving(false);
    if (result.error)
      setError(t("misionJuvenil.errorRegistrarGrupo"));
    else {
      setNotice(t("misionJuvenil.grupoRegistrado"));
      setGroupForm({
        nombre: "",
        institucion_id: "",
        direccion: "",
        lider_persona_id: "",
        leccion_actual: "",
      });
      load();
    }
  }
  if (roleLoading || loading)
    return (
      <div className="module-loading" role="status">
        <span className="loading-dot" />
        {t("misionJuvenil.cargando")}
      </div>
    );
  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("misionJuvenil.eyebrow")}</p>
          <h1 className="section-title">{t("misionJuvenil.titulo")}</h1>
          <p className="text-sm text-secondary mt-1">
            {t("misionJuvenil.subtitulo")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex gap-1.5"
            role="group"
            aria-label={t("misionJuvenil.periodoAnalisis")}
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
      {canEdit === false && <p className="text-sm text-secondary bg-surface-1 rounded p-3">{t("misionJuvenil.soloConsulta")}</p>}
      <Toast>{notice}</Toast>
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label={t("misionJuvenil.metricInstituciones")} value={instituciones.length} progress={instituciones.length ? Math.round((establishedInstitutions / instituciones.length) * 100) : 0} detail={t("misionJuvenil.metricConGrupoEstablecido", { cantidad: establishedInstitutions })} insight={instituciones.length ? t("misionJuvenil.insightInstitucionesConDatos") : t("misionJuvenil.insightInstitucionesVacio")} />
        <Metric label={t("misionJuvenil.metricEstudiantesProceso")} value={activeSympathizers} progress={students.length ? Math.round((activeSympathizers / students.length) * 100) : 0} detail={t("misionJuvenil.metricDeEstudiantes", { activos: activeSympathizers, total: students.length })} insight={activeSympathizers ? t("misionJuvenil.insightEstudiantesConDatos") : t("misionJuvenil.insightEstudiantesVacio")} />
        <Metric label={t("misionJuvenil.metricGruposRefam")} value={activeGroups} progress={students.length ? Math.min(100, studentsPerGroup * 10) : 0} detail={t("misionJuvenil.metricEstudiantesPorGrupo", { cantidad: studentsPerGroup })} insight={activeGroups ? t("misionJuvenil.insightGruposConDatos") : t("misionJuvenil.insightGruposVacio")} info={t("misionJuvenil.infoRefam")} />
        <Metric label={t("misionJuvenil.metricAsistenciaPromedio")} value={average} progress={attendanceRate} detail={t("misionJuvenil.metricRegistrosActividad", { cantidad: registros.length })} insight={average ? t("misionJuvenil.insightAsistenciaConDatos") : t("misionJuvenil.insightAsistenciaVacio")} />
        <Metric label={t("misionJuvenil.metricBautizados")} value={baptized} tone="text-success" progress={baptismRate} detail={t("misionJuvenil.metricPctEstudiantesActivos", { pct: baptismRate })} insight={baptized ? t("misionJuvenil.insightBautizadosConDatos") : t("misionJuvenil.insightBautizadosVacio")} />
        <Metric label={t("misionJuvenil.metricSellados")} value={sealed} progress={activeStudents ? Math.round((sealed / activeStudents) * 100) : 0} detail={t("misionJuvenil.detalleConEspirituSanto")} insight={t("misionJuvenil.insightSellados")} />
        <Metric label={t("misionJuvenil.metricRegistrosDeActividad")} value={registros.length} progress={registros.length ? 100 : 0} detail={t("misionJuvenil.metricAsistentesAcumulados", { cantidad: attendance })} insight={registros.length ? t("misionJuvenil.insightRegistrosConDatos") : t("misionJuvenil.insightRegistrosVacio")} />
      </section>
      <section className="card p-5">
        <div className="flex items-start gap-3 pb-4 border-b border-border">
          <span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center">
            <Target className="w-4 h-4" />
          </span>
          <div>
            <p className="eyebrow">{t("misionJuvenil.filtrosParaDecidir")}</p>
            <h2 className="font-medium mt-1">{t("misionJuvenil.impactoJuvenil")}</h2>
            <p className="text-xs text-secondary mt-1">
              {t("misionJuvenil.impactoJuvenilDesc")}
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <label className="text-xs text-secondary">
            {t("misionJuvenil.institucion")}
            <select
              className="input-field mt-1.5"
              value={institucionFiltro}
              onChange={(event) => setInstitucionFiltro(event.target.value)}
            >
              <option value="todos">{t("misionJuvenil.todasInstituciones")}</option>
              {instituciones.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-secondary flex items-center gap-1">
            {t("misionJuvenil.estadoEspiritual")}
            <InfoTip texto={t("misionJuvenil.estadoEspiritualTip")} />
            <select
              className="input-field mt-1.5 w-full"
              value={estadoFiltro}
              onChange={(event) => setEstadoFiltro(event.target.value)}
            >
              <option value="todos">{t("misionJuvenil.todosEstados")}</option>
              {Object.entries(ESTADOS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <p className="text-sm text-secondary bg-surface-1 rounded p-3">
        {insight}
      </p>
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("misionJuvenil.actividadJuvenilRegistrada")}</p>
          <h2 className="font-medium mt-1">{t("misionJuvenil.actividadJuvenil")}</h2>
          <p className="text-xs text-secondary mt-1">{t("misionJuvenil.actividadJuvenilDesc")}</p>
          <div className="h-56 mt-4">
            {trend.length ? (
              <Line
                data={trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: t("misionJuvenil.asistentes") })}
                options={CHART_OPTIONS}
              />
            ) : (
              <ChartEmpty message={t("misionJuvenil.sinActividadesPeriodo")} />
            )}
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">{t("misionJuvenil.crecimiento")}</p>
          <h2 className="font-medium mt-1">{t("misionJuvenil.estadoDeEstudiantes")}</h2>
          <div className="h-56 mt-4">
            {students.length ? (
              <Bar
                data={distributionDataset(statusRows, { datasetLabel: t("misionJuvenil.estudiantesLabel") })}
                options={CHART_OPTIONS}
              />
            ) : (
              <ChartEmpty message={t("misionJuvenil.sinEstudiantesFiltros")} />
            )}
          </div>
        </div>
      </section>
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{t("misionJuvenil.detalleEstudiantes")}</p>
            <h2 className="font-medium mt-1">{t("misionJuvenil.estudiantesPorEstado")}</h2>
            <p className="text-xs text-secondary mt-1">{t("misionJuvenil.consultaNombres")}</p>
          </div>
          <UsersRound className="w-5 h-5 text-accent" />
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="py-2">{t("misionJuvenil.colEstudiante")}</th>
                <th className="py-2">{t("misionJuvenil.colInstitucion")}</th>
                <th className="py-2">{t("misionJuvenil.colGradoSemestre")}</th>
                <th className="py-2">{t("misionJuvenil.colEstado")}</th>
                <th className="py-2"><span className="flex items-center gap-1.5">{t("misionJuvenil.colHitos")}<InfoTip texto={t("misionJuvenil.hitosTip")} /></span></th>
                <th className="py-2"><span className="flex items-center gap-1.5">{t("misionJuvenil.colRutaEvangelistica")}<InfoTip texto={t("misionJuvenil.rutaEvangelisticaTip")} /></span></th>
              </tr>
            </thead>
            <tbody>
              {studentsPageItems.map((student) => {
                const yaVinculado = estudiantesVinculados.has(student.id);
                return (
                <tr key={student.id} className="border-b border-border align-top">
                  <td className="py-2 font-medium">{student.nombres} {student.apellidos}</td>
                  <td className="py-2 text-secondary">{student.mision_instituciones?.nombre || t("misionJuvenil.sinInstitucion")}</td>
                  <td className="py-2 text-secondary">{student.grado_semestre || t("misionJuvenil.sinDato")}</td>
                  <td className="py-2"><span className="text-xs px-2 py-1 rounded bg-accent-bg text-accent">{ESTADOS[student.estado] || student.estado}</span></td>
                  <td className="py-2">
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {student.bautizado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">{t("misionJuvenil.bautizadoBadge")}</span>}
                      {student.sellado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">{t("misionJuvenil.selladoBadge")}</span>}
                      {canEdit && !student.bautizado && <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => marcarHitoEstudiante(student, "bautizado", "fecha_bautismo")}>{t("misionJuvenil.marcarBautizado")}</button>}
                      {canEdit && !student.sellado && <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => marcarHitoEstudiante(student, "sellado", "fecha_sellado")}>{t("misionJuvenil.marcarSellado")}</button>}
                    </div>
                  </td>
                  <td className="py-2">
                    {yaVinculado ? <span className="text-xs text-success">{t("misionJuvenil.vinculado")}</span> : canEdit ? (
                      vinculandoId === student.id ? (
                        <div className="flex flex-col gap-1.5 min-w-[180px]">
                          <select className="input-field text-xs py-1" value={responsableVinculoId} onChange={(event) => setResponsableVinculoId(event.target.value)}>
                            <option value="">{t("misionJuvenil.responsableSeleccionar")}</option>
                            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
                          </select>
                          <div className="flex gap-1.5">
                            <button type="button" disabled={saving} className="btn-primary text-xs py-1 px-2 flex-1" onClick={() => vincularRutaEvangelistica(student)}>{t("misionJuvenil.confirmar")}</button>
                            <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => { setVinculandoId(null); setResponsableVinculoId(""); }}>{t("misionJuvenil.cancelar")}</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => (student.bautizado ? vincularRutaEvangelistica(student) : setVinculandoId(student.id))}>
                          {t("misionJuvenil.vincular")}
                        </button>
                      )
                    ) : <span className="text-xs text-muted">—</span>}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {!students.length && <p className="text-sm text-secondary py-6 text-center">{t("misionJuvenil.sinEstudiantesFiltrosSeleccionados")}</p>}
          <Pager page={studentsPageSafe} totalPages={studentsPageCount} total={students.length} onPrev={() => setStudentsPage((current) => current - 1)} onNext={() => setStudentsPage((current) => current + 1)} label={t("misionJuvenil.estudiantesLabel").toLowerCase()} />
        </div>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{t("misionJuvenil.incursionTerritorial")}</p>
              <h2 className="font-medium mt-1">{t("misionJuvenil.institucionesImpactadas")}</h2>
            </div>
            <Building2 className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-2">{t("misionJuvenil.colInstitucion")}</th>
                  <th className="py-2">{t("misionJuvenil.colFase")}</th>
                  <th className="py-2 text-right">{t("misionJuvenil.colEst")}</th>
                  <th className="py-2 text-right">{t("misionJuvenil.colGrupos")}</th>
                </tr>
              </thead>
              <tbody>
                {institutionRows.map((institution) => (
                  <tr key={institution.id} className="border-b border-border">
                    <td className="py-2">
                      <p className="font-medium">{institution.nombre}</p>
                      <p className="text-xs text-muted">
                        {NIVEL_INSTITUCION_LABELS[institution.nivel] || institution.nivel} · {TIPO_INSTITUCION_LABELS[institution.tipo] || institution.tipo}
                      </p>
                    </td>
                    <td className="py-2 text-xs">
                      {t("misionJuvenil.faseNumero", { numero: institution.fase })}
                      <span className="block text-muted">
                        {FASES[institution.fase]}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {institution.estudiantes}
                    </td>
                    <td className="py-2 text-right">{institution.grupos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{t("misionJuvenil.crecimiento")}</p>
              <h2 className="font-medium mt-1">{t("misionJuvenil.gruposYLecciones")}</h2>
            </div>
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div className="flex flex-col divide-y divide-border mt-4">
            {grupos.map((group) => (
              <button type="button" key={group.id} onClick={() => loadLecciones(group.id)} className={`py-3 text-left ${selectedGrupoId === group.id ? "bg-accent-bg -mx-2 px-2 rounded" : ""}`}>
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{group.nombre}</p>
                  <span className="text-xs text-accent">
                    {t("misionJuvenil.leccionProgreso", { actual: group.leccion_actual, total: group.lecciones_total })}
                  </span>
                </div>
                <p className="text-xs text-secondary mt-1">
                  {group.mision_instituciones?.nombre || t("misionJuvenil.sinInstitucion")} ·{" "}
                  {group.personas
                    ? `${group.personas.nombres} ${group.personas.apellidos}`
                    : t("misionJuvenil.sinLider")}
                </p>
              </button>
            ))}
            {!grupos.length && (
              <p className="text-sm text-muted py-6">
                {t("misionJuvenil.sinGruposRegistrados")}
              </p>
            )}
          </div>
          {selectedGrupoId && (() => {
            const grupoSeleccionado = grupos.find((item) => item.id === selectedGrupoId);
            const estudiantesGrupo = estudiantes.filter((estudiante) => estudiante.institucion_id === grupoSeleccionado?.institucion_id);
            return <div className="border-t border-border mt-4 pt-4">
              <p className="text-sm font-medium mb-2">{t("misionJuvenil.leccionesDe", { nombre: grupoSeleccionado?.nombre })}</p>
              {canEdit && <form onSubmit={createLeccion} className="grid gap-2 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  <input required className="input-field" placeholder={t("misionJuvenil.temaLeccion")} value={leccionForm.tema} onChange={(event) => setLeccionForm({ ...leccionForm, tema: event.target.value })} />
                  <input required type="date" className="input-field" value={leccionForm.fecha} onChange={(event) => setLeccionForm({ ...leccionForm, fecha: event.target.value })} />
                </div>
                <textarea className="input-field min-h-14" placeholder={t("misionJuvenil.notasOpcional")} value={leccionForm.notas} onChange={(event) => setLeccionForm({ ...leccionForm, notas: event.target.value })} />
                {estudiantesGrupo.length > 0 && <div>
                  <p className="text-xs text-secondary mb-1">{t("misionJuvenil.asistenciaIndividual")}</p>
                  <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                    {estudiantesGrupo.map((estudiante) => <label key={estudiante.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[estudiante.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [estudiante.id]: event.target.checked })} />{estudiante.nombres} {estudiante.apellidos}</label>)}
                  </div>
                </div>}
                <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />{t("misionJuvenil.registrarLeccion")}</button>
              </form>}
              {lecciones.length ? <div className="divide-y divide-border">{lecciones.map((leccion) => <div key={leccion.id} className="py-2"><p className="text-sm">{t("misionJuvenil.leccionResumen", { numero: leccion.numero, tema: leccion.tema })}</p><p className="text-xs text-secondary">{t("misionJuvenil.leccionFechaAsistentes", { fecha: leccion.fecha, asistentes: leccion.asistentes })}</p></div>)}</div> : <p className="text-xs text-muted">{t("misionJuvenil.sinLeccionesGrupo")}</p>}
            </div>;
          })()}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div><p className="eyebrow">{t("misionJuvenil.equipo")}</p><h2 className="font-medium mt-1">{t("misionJuvenil.lideresMisionJuvenil")}</h2></div>
          <UsersRound className="w-5 h-5 text-accent" />
        </div>
        {canEdit && <form onSubmit={createLider} className="grid sm:grid-cols-3 gap-2 mb-4">
          <select required className="input-field" value={liderForm.persona_id} onChange={(event) => setLiderForm({ ...liderForm, persona_id: event.target.value })}>
            <option value="">{t("misionJuvenil.seleccionaPersona")}</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <input className="input-field" placeholder={t("misionJuvenil.rolPlaceholder")} value={liderForm.rol} onChange={(event) => setLiderForm({ ...liderForm, rol: event.target.value })} />
          <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />{t("misionJuvenil.registrarLider")}</button>
        </form>}
        <div className="divide-y divide-border">{lideres.filter((lider) => lider.activo !== false).map((lider) => <div key={lider.id} className="py-2 flex items-center justify-between gap-3"><div><p className="text-sm">{lider.personas?.nombres} {lider.personas?.apellidos}</p><p className="text-xs text-secondary">{lider.rol}</p></div>{canEdit && <button type="button" onClick={() => toggleLider(lider)} className="text-xs text-danger">{t("misionJuvenil.desactivar")}</button>}</div>)}{lideres.filter((lider) => lider.activo !== false).length === 0 && <p className="text-sm text-muted py-4">{t("misionJuvenil.sinLideresRegistrados")}</p>}</div>
      </section>
      <section className="grid lg:grid-cols-3 gap-4">
        <form
          onSubmit={createInstitution}
          className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}
        >
          <h2 className="font-medium">{t("misionJuvenil.nuevaInstitucion")}</h2>
          <input
            required
            className="input-field"
            placeholder={t("misionJuvenil.nombrePlantel")}
            value={institutionForm.nombre}
            onChange={(event) =>
              setInstitutionForm({
                ...institutionForm,
                nombre: event.target.value,
              })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="input-field"
              value={institutionForm.tipo}
              onChange={(event) =>
                setInstitutionForm({
                  ...institutionForm,
                  tipo: event.target.value,
                })
              }
            >
              <option value="publica">{t("misionJuvenil.tipoPublica")}</option>
              <option value="privada">{t("misionJuvenil.tipoPrivada")}</option>
            </select>
            <select
              className="input-field"
              value={institutionForm.nivel}
              onChange={(event) =>
                setInstitutionForm({
                  ...institutionForm,
                  nivel: event.target.value,
                })
              }
            >
              <option value="bachillerato">{t("misionJuvenil.nivelBachillerato")}</option>
              <option value="universidad">{t("misionJuvenil.nivelUniversidad")}</option>
              <option value="otro">{t("misionJuvenil.nivelOtro")}</option>
            </select>
          </div>
          <input
            className="input-field"
            placeholder={t("misionJuvenil.direccionUbicacion")}
            value={institutionForm.direccion}
            onChange={(event) =>
              setInstitutionForm({
                ...institutionForm,
                direccion: event.target.value,
              })
            }
          />
          <input
            className="input-field"
            placeholder={t("misionJuvenil.rectorCoordinador")}
            value={institutionForm.contacto_nombre}
            onChange={(event) =>
              setInstitutionForm({
                ...institutionForm,
                contacto_nombre: event.target.value,
              })
            }
          />
          <select
            className="input-field"
            value={institutionForm.fase}
            onChange={(event) =>
              setInstitutionForm({
                ...institutionForm,
                fase: event.target.value,
              })
            }
          >
            <option value="1">{t("misionJuvenil.fase1Opcion")}</option>
            <option value="2">{t("misionJuvenil.fase2Opcion")}</option>
            <option value="3">{t("misionJuvenil.fase3Opcion")}</option>
          </select>
          <button disabled={saving} className="btn-primary justify-center">
            <Plus className="w-4 h-4" /> {t("misionJuvenil.registrarInstitucion")}
          </button>
        </form>
        <form onSubmit={createStudent} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">{t("misionJuvenil.nuevoEstudiante")}</h2>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              className="input-field"
              placeholder={t("misionJuvenil.placeholderNombres")}
              value={studentForm.nombres}
              onChange={(event) =>
                setStudentForm({ ...studentForm, nombres: event.target.value })
              }
            />
            <input
              required
              className="input-field"
              placeholder={t("misionJuvenil.placeholderApellidos")}
              value={studentForm.apellidos}
              onChange={(event) =>
                setStudentForm({
                  ...studentForm,
                  apellidos: event.target.value,
                })
              }
            />
          </div>
          <select
            className="input-field"
            value={studentForm.institucion_id}
            onChange={(event) =>
              setStudentForm({
                ...studentForm,
                institucion_id: event.target.value,
              })
            }
          >
            <option value="">{t("misionJuvenil.institucion")}</option>
            {instituciones.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.nombre}
              </option>
            ))}
          </select>
          <input
            className="input-field"
            placeholder={t("misionJuvenil.gradoOSemestre")}
            value={studentForm.grado_semestre}
            onChange={(event) =>
              setStudentForm({
                ...studentForm,
                grado_semestre: event.target.value,
              })
            }
          />
          <select
            className="input-field"
            value={studentForm.estado}
            onChange={(event) =>
              setStudentForm({ ...studentForm, estado: event.target.value })
            }
          >
            {Object.entries(ESTADOS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="input-field"
            value={studentForm.tutor_persona_id}
            onChange={(event) =>
              setStudentForm({
                ...studentForm,
                tutor_persona_id: event.target.value,
              })
            }
          >
            <option value="">{t("misionJuvenil.tutorOLider")}</option>
            {personas.map((person) => (
              <option key={person.id} value={person.id}>
                {person.nombres} {person.apellidos}
              </option>
            ))}
          </select>
          <button disabled={saving} className="btn-secondary justify-center">
            <Plus className="w-4 h-4" /> {t("misionJuvenil.registrarEstudiante")}
          </button>
        </form>
        <form onSubmit={createGroup} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">{t("misionJuvenil.nuevoGrupoRefam")}</h2>
          <input
            required
            className="input-field"
            placeholder={t("misionJuvenil.nombreGrupo")}
            value={groupForm.nombre}
            onChange={(event) =>
              setGroupForm({ ...groupForm, nombre: event.target.value })
            }
          />
          <select
            className="input-field"
            value={groupForm.institucion_id}
            onChange={(event) =>
              setGroupForm({ ...groupForm, institucion_id: event.target.value })
            }
          >
            <option value="">{t("misionJuvenil.institucionOrigen")}</option>
            {instituciones.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.nombre}
              </option>
            ))}
          </select>
          <input
            className="input-field"
            placeholder={t("misionJuvenil.direccionReunion")}
            value={groupForm.direccion}
            onChange={(event) =>
              setGroupForm({ ...groupForm, direccion: event.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              min="1"
              type="number"
              placeholder={t("misionJuvenil.leccionActualPlaceholder")}
              className="input-field"
              value={groupForm.leccion_actual}
              onChange={(event) =>
                setGroupForm({
                  ...groupForm,
                  leccion_actual: event.target.value,
                })
              }
            />
            <select
              className="input-field"
              value={groupForm.lider_persona_id}
              onChange={(event) =>
                setGroupForm({
                  ...groupForm,
                  lider_persona_id: event.target.value,
                })
              }
            >
              <option value="">{t("misionJuvenil.lider")}</option>
              {personas.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.nombres} {person.apellidos}
                </option>
              ))}
            </select>
          </div>
          <button disabled={saving} className="btn-primary justify-center">
            <Plus className="w-4 h-4" /> {t("misionJuvenil.crearGrupo")}
          </button>
        </form>
      </section>
    </div>
  );
}
