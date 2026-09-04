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
import { supabase } from "../lib/supabase";
import { useMiRol } from "../hooks/useMiRol";
import { chartOptions, trendDataset, distributionDataset } from "../lib/chartTheme";
import Pager from "../components/Pager";
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
const FASES = {
  1: "Contacto inicial",
  2: "Talleres de valores",
  3: "Grupo establecido",
};
const ESTADOS = {
  simpatizante: "Simpatizante",
  refam: "Asistente a REFAM",
  discipulado: "En discipulado",
  bautizado: "Bautizado",
  inactivo: "Inactivo",
};
const CHART_OPTIONS = chartOptions();

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
  const [canEdit, setCanEdit] = useState(false);
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
  const [leccionForm, setLeccionForm] = useState({ tema: "", fecha: new Date().toISOString().slice(0, 10), notas: "" });
  const [asistenciaMarcada, setAsistenciaMarcada] = useState({});
  const [lideres, setLideres] = useState([]);
  const [liderForm, setLiderForm] = useState({ persona_id: "", rol: "gestor" });
  const [studentsPage, setStudentsPage] = useState(0);

  async function load() {
    if (!congregacionId) {
      setLoading(false);
      setError("Tu usuario no tiene una congregación local asignada.");
      return;
    }
    setLoading(true);
    setError(null);
    const start = new Date();
    start.setDate(start.getDate() - Number(periodo));
    const [i, s, g, r, p, l] = await Promise.all([
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
        .gte("fecha", start.toISOString().slice(0, 10))
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
    ]);
    const failed = [i, s, g, r, p, l].find((item) => item.error);
    if (failed)
      setError(
        "No se pudo cargar Misión Juvenil. Intenta nuevamente o contacta al administrador.",
      );
    setInstituciones(i.data ?? []);
    setEstudiantes(s.data ?? []);
    setGrupos(g.data ?? []);
    setRegistros(r.data ?? []);
    setPersonas(p.data ?? []);
    setLideres(l.data ?? []);
    setLoading(false);
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
    if (leccionesError) setError("No se pudo cargar el historial de lecciones.");
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
      setError(`No se pudo registrar la lección: ${leccionResult.error.message}`);
      return;
    }
    if (estudiantesGrupo.length > 0) {
      const asistenciaResult = await supabase.from("mision_asistencia_estudiante").insert(
        estudiantesGrupo.map((estudiante) => ({ leccion_id: leccionResult.data.id, estudiante_id: estudiante.id, asistio: Boolean(asistenciaMarcada[estudiante.id]) })),
      );
      if (asistenciaResult.error) { setSaving(false); setError(`La lección se guardó, pero no se pudo registrar la asistencia individual: ${asistenciaResult.error.message}`); return; }
    }
    if (proximoNumero > (grupo?.leccion_actual || 0)) {
      await supabase.from("mision_grupos").update({ leccion_actual: proximoNumero }).eq("id", selectedGrupoId).eq("congregacion_id", congregacionId);
    }
    setSaving(false);
    setNotice("Lección registrada con asistencia individual.");
    setLeccionForm({ tema: "", fecha: new Date().toISOString().slice(0, 10), notas: "" });
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
      setError(result.error.code === "23505" ? "Esta persona ya está registrada como líder." : `No se pudo registrar el líder: ${result.error.message}`);
      return;
    }
    setNotice("Líder registrado.");
    setLiderForm({ persona_id: "", rol: "gestor" });
    load();
  }

  async function toggleLider(lider) {
    const result = await supabase.from("mision_lideres").update({ activo: lider.activo === false }).eq("id", lider.id).eq("congregacion_id", congregacionId);
    if (result.error) { setError(`No se pudo cambiar el estado del líder: ${result.error.message}`); return; }
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
  const activeGroups = grupos.filter((group) => group.activo !== false).length;
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
    ? `${topInstitution.nombre} concentra ${topInstitution.estudiantes} estudiantes registrados. Prioriza allí los tutores y grupos que sostengan la continuidad.`
    : "Registra instituciones y estudiantes para construir una lectura de impacto juvenil.";
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
      setError("No se pudo registrar la institución. Intenta nuevamente o contacta al administrador.");
    else {
      setNotice("Institución registrada.");
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
    const hoy = new Date().toISOString().slice(0, 10);
    const result = await supabase.from("mision_estudiantes").update({ [campo]: true, [fechaCampo]: hoy }).eq("id", student.id).eq("congregacion_id", congregacionId);
    setSaving(false);
    if (result.error) { setError(`No se pudo actualizar la ficha: ${result.error.message}`); return; }
    setNotice("Ficha actualizada.");
    load();
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
      setError("No se pudo registrar el estudiante. Intenta nuevamente o contacta al administrador.");
    else {
      setNotice("Estudiante registrado.");
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
      setError("No se pudo registrar el grupo. Intenta nuevamente o contacta al administrador.");
    else {
      setNotice("Grupo juvenil registrado.");
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
        Cargando Misión Juvenil...
      </div>
    );
  return (
    <div className="page-shell">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Trabajo juvenil</p>
          <h1 className="section-title">Misión Juvenil</h1>
          <p className="text-sm text-secondary mt-1">
            Instituciones, estudiantes, grupos REFAM y crecimiento espiritual.
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
      {!canEdit && <p className="text-sm text-secondary bg-surface-1 rounded p-3">Tienes acceso de consulta. Las altas y modificaciones requieren el permiso de edición de Misión Juvenil.</p>}
      {notice && (
        <p
          role="status"
          className="text-sm text-success bg-success-bg rounded p-3"
        >
          {notice}
        </p>
      )}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label="Instituciones" value={instituciones.length} progress={instituciones.length ? Math.round((establishedInstitutions / instituciones.length) * 100) : 0} detail={`${establishedInstitutions} con grupo establecido`} insight={instituciones.length ? "Fortalece las instituciones que aún están en contacto inicial." : "Registra la primera institución para iniciar el trabajo."} />
        <Metric label="Estudiantes en proceso" value={activeSympathizers} progress={students.length ? Math.round((activeSympathizers / students.length) * 100) : 0} detail={`${activeSympathizers} de ${students.length} estudiantes`} insight={activeSympathizers ? "Revisa quién necesita avanzar a REFAM o discipulado." : "Aún no hay estudiantes en proceso activo."} />
        <Metric label="Grupos REFAM" value={activeGroups} progress={students.length ? Math.min(100, studentsPerGroup * 10) : 0} detail={`${studentsPerGroup} estudiantes por grupo`} insight={activeGroups ? "Comprueba que cada grupo tenga líder y continuidad de lecciones." : "Crea un grupo para organizar el acompañamiento."} info="REFAM (Reunión Familiar y de Amistad) son los grupos pequeños donde los estudiantes reciben lecciones bíblicas, dentro o cerca de la institución." />
        <Metric label="Asistencia promedio" value={average} progress={attendanceRate} detail={`${registros.length} registros de actividad`} insight={average ? "Compara la asistencia con el número de estudiantes para detectar continuidad." : "Registra actividades para conocer la participación juvenil."} />
        <Metric label="Bautizados" value={baptized} tone="text-success" progress={baptismRate} detail={`${baptismRate}% de estudiantes activos`} insight={baptized ? "Asegura la continuidad de cada bautizado hacia el discipulado." : "Acompaña el proceso espiritual y la preparación bautismal."} />
        <Metric label="Sellados" value={sealed} progress={activeStudents ? Math.round((sealed / activeStudents) * 100) : 0} detail="Con el Espíritu Santo" insight="Puede pasar antes o después del bautismo en agua, independiente del proceso REFAM." />
        <Metric label="Registros de actividad" value={registros.length} progress={registros.length ? 100 : 0} detail={`${attendance} asistentes acumulados`} insight={registros.length ? "Usa la tendencia para identificar crecimiento o disminución." : "Aún no hay actividad registrada en el periodo."} />
      </section>
      <section className="card p-5">
        <div className="flex items-start gap-3 pb-4 border-b border-border">
          <span className="w-9 h-9 rounded bg-accent-bg text-accent flex items-center justify-center">
            <Target className="w-4 h-4" />
          </span>
          <div>
            <p className="eyebrow">Filtros para decidir</p>
            <h2 className="font-medium mt-1">Impacto juvenil</h2>
            <p className="text-xs text-secondary mt-1">
              Compara instituciones y estados espirituales sin alterar los datos
              capturados.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <label className="text-xs text-secondary">
            Institución
            <select
              className="input-field mt-1.5"
              value={institucionFiltro}
              onChange={(event) => setInstitucionFiltro(event.target.value)}
            >
              <option value="todos">Todas las instituciones</option>
              {instituciones.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-secondary flex items-center gap-1">
            Estado espiritual
            <InfoTip texto="Filtra por el avance de cada estudiante: simpatizante, asistente a REFAM, en discipulado o ya bautizado. Ese estado se define al registrar o editar cada estudiante." />
            <select
              className="input-field mt-1.5 w-full"
              value={estadoFiltro}
              onChange={(event) => setEstadoFiltro(event.target.value)}
            >
              <option value="todos">Todos los estados</option>
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
          <p className="eyebrow">Actividad juvenil registrada</p>
          <h2 className="font-medium mt-1">Actividad juvenil</h2>
          <div className="h-56 mt-4">
            <Line
              data={trendDataset(trend.map((item) => item.fecha), trend.map((item) => item.total), { label: "Asistentes" })}
              options={CHART_OPTIONS}
            />
          </div>
        </div>
        <div className="card chart-card p-5">
          <p className="eyebrow">Crecimiento</p>
          <h2 className="font-medium mt-1">Estado de estudiantes</h2>
          <div className="h-56 mt-4">
            <Bar
              data={distributionDataset(statusRows, { datasetLabel: "Estudiantes" })}
              options={CHART_OPTIONS}
            />
          </div>
        </div>
      </section>
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Detalle de estudiantes</p>
            <h2 className="font-medium mt-1">Estudiantes por estado</h2>
            <p className="text-xs text-secondary mt-1">Consulta los nombres que componen cada resultado del gráfico.</p>
          </div>
          <UsersRound className="w-5 h-5 text-accent" />
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="py-2">Estudiante</th>
                <th className="py-2">Institución</th>
                <th className="py-2">Grado / semestre</th>
                <th className="py-2">Estado</th>
                <th className="py-2"><span className="flex items-center gap-1.5">Hitos<InfoTip texto="Bautizado y sellado son hitos independientes. Una vez marcados aquí no hay botón para deshacerlos." /></span></th>
              </tr>
            </thead>
            <tbody>
              {studentsPageItems.map((student) => (
                <tr key={student.id} className="border-b border-border">
                  <td className="py-2 font-medium">{student.nombres} {student.apellidos}</td>
                  <td className="py-2 text-secondary">{student.mision_instituciones?.nombre || "Sin institución"}</td>
                  <td className="py-2 text-secondary">{student.grado_semestre || "Sin dato"}</td>
                  <td className="py-2"><span className="text-xs px-2 py-1 rounded bg-accent-bg text-accent">{ESTADOS[student.estado] || student.estado}</span></td>
                  <td className="py-2">
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {student.bautizado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">Bautizado</span>}
                      {student.sellado && <span className="text-[11px] px-2 py-0.5 rounded bg-accent-bg text-accent">Sellado</span>}
                      {canEdit && !student.bautizado && <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => marcarHitoEstudiante(student, "bautizado", "fecha_bautismo")}>Marcar bautizado</button>}
                      {canEdit && !student.sellado && <button type="button" className="text-[11px] btn-secondary px-2 py-0.5" onClick={() => marcarHitoEstudiante(student, "sellado", "fecha_sellado")}>Marcar sellado</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && <p className="text-sm text-secondary py-6 text-center">No hay estudiantes para los filtros seleccionados.</p>}
          <Pager page={studentsPageSafe} totalPages={studentsPageCount} total={students.length} onPrev={() => setStudentsPage((current) => current - 1)} onNext={() => setStudentsPage((current) => current + 1)} label="estudiantes" />
        </div>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Incursión territorial</p>
              <h2 className="font-medium mt-1">Instituciones impactadas</h2>
            </div>
            <Building2 className="w-5 h-5 text-accent" />
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-2">Institución</th>
                  <th className="py-2">Fase</th>
                  <th className="py-2 text-right">Est.</th>
                  <th className="py-2 text-right">Grupos</th>
                </tr>
              </thead>
              <tbody>
                {institutionRows.map((institution) => (
                  <tr key={institution.id} className="border-b border-border">
                    <td className="py-2">
                      <p className="font-medium">{institution.nombre}</p>
                      <p className="text-xs text-muted">
                        {institution.nivel} · {institution.tipo}
                      </p>
                    </td>
                    <td className="py-2 text-xs">
                      Fase {institution.fase}
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
              <p className="eyebrow">Crecimiento</p>
              <h2 className="font-medium mt-1">Grupos y lecciones</h2>
            </div>
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div className="flex flex-col divide-y divide-border mt-4">
            {grupos.map((group) => (
              <button type="button" key={group.id} onClick={() => loadLecciones(group.id)} className={`py-3 text-left ${selectedGrupoId === group.id ? "bg-accent-bg -mx-2 px-2 rounded" : ""}`}>
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{group.nombre}</p>
                  <span className="text-xs text-accent">
                    Lección {group.leccion_actual}/{group.lecciones_total}
                  </span>
                </div>
                <p className="text-xs text-secondary mt-1">
                  {group.mision_instituciones?.nombre || "Sin institución"} ·{" "}
                  {group.personas
                    ? `${group.personas.nombres} ${group.personas.apellidos}`
                    : "Sin líder"}
                </p>
              </button>
            ))}
            {!grupos.length && (
              <p className="text-sm text-muted py-6">
                Aún no hay grupos registrados.
              </p>
            )}
          </div>
          {selectedGrupoId && (() => {
            const grupoSeleccionado = grupos.find((item) => item.id === selectedGrupoId);
            const estudiantesGrupo = estudiantes.filter((estudiante) => estudiante.institucion_id === grupoSeleccionado?.institucion_id);
            return <div className="border-t border-border mt-4 pt-4">
              <p className="text-sm font-medium mb-2">Lecciones de {grupoSeleccionado?.nombre}</p>
              {canEdit && <form onSubmit={createLeccion} className="grid gap-2 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  <input required className="input-field" placeholder="Tema de la lección" value={leccionForm.tema} onChange={(event) => setLeccionForm({ ...leccionForm, tema: event.target.value })} />
                  <input required type="date" className="input-field" value={leccionForm.fecha} onChange={(event) => setLeccionForm({ ...leccionForm, fecha: event.target.value })} />
                </div>
                <textarea className="input-field min-h-14" placeholder="Notas (opcional)" value={leccionForm.notas} onChange={(event) => setLeccionForm({ ...leccionForm, notas: event.target.value })} />
                {estudiantesGrupo.length > 0 && <div>
                  <p className="text-xs text-secondary mb-1">Asistencia individual</p>
                  <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded p-2">
                    {estudiantesGrupo.map((estudiante) => <label key={estudiante.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(asistenciaMarcada[estudiante.id])} onChange={(event) => setAsistenciaMarcada({ ...asistenciaMarcada, [estudiante.id]: event.target.checked })} />{estudiante.nombres} {estudiante.apellidos}</label>)}
                  </div>
                </div>}
                <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />Registrar lección</button>
              </form>}
              {lecciones.length ? <div className="divide-y divide-border">{lecciones.map((leccion) => <div key={leccion.id} className="py-2"><p className="text-sm">Lección {leccion.numero}: {leccion.tema}</p><p className="text-xs text-secondary">{leccion.fecha} · {leccion.asistentes} asistentes</p></div>)}</div> : <p className="text-xs text-muted">Aún no hay lecciones registradas para este grupo.</p>}
            </div>;
          })()}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div><p className="eyebrow">Equipo</p><h2 className="font-medium mt-1">Líderes de Misión Juvenil</h2></div>
          <UsersRound className="w-5 h-5 text-accent" />
        </div>
        {canEdit && <form onSubmit={createLider} className="grid sm:grid-cols-3 gap-2 mb-4">
          <select required className="input-field" value={liderForm.persona_id} onChange={(event) => setLiderForm({ ...liderForm, persona_id: event.target.value })}>
            <option value="">Selecciona una persona</option>
            {personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombres} {persona.apellidos}</option>)}
          </select>
          <input className="input-field" placeholder="Rol (ej. gestor, maestro)" value={liderForm.rol} onChange={(event) => setLiderForm({ ...liderForm, rol: event.target.value })} />
          <button disabled={saving} className="btn-secondary justify-center"><Plus className="w-4 h-4" />Registrar líder</button>
        </form>}
        <div className="divide-y divide-border">{lideres.filter((lider) => lider.activo !== false).map((lider) => <div key={lider.id} className="py-2 flex items-center justify-between gap-3"><div><p className="text-sm">{lider.personas?.nombres} {lider.personas?.apellidos}</p><p className="text-xs text-secondary">{lider.rol}</p></div>{canEdit && <button type="button" onClick={() => toggleLider(lider)} className="text-xs text-danger">Desactivar</button>}</div>)}{lideres.filter((lider) => lider.activo !== false).length === 0 && <p className="text-sm text-muted py-4">Aún no hay líderes registrados.</p>}</div>
      </section>
      <section className="grid lg:grid-cols-3 gap-4">
        <form
          onSubmit={createInstitution}
          className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}
        >
          <h2 className="font-medium">Nueva institución</h2>
          <input
            required
            className="input-field"
            placeholder="Nombre del plantel"
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
              <option value="publica">Pública</option>
              <option value="privada">Privada</option>
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
              <option value="bachillerato">Bachillerato</option>
              <option value="universidad">Universidad</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <input
            className="input-field"
            placeholder="Dirección o ubicación"
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
            placeholder="Rector / coordinador"
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
            <option value="1">Fase 1: Contacto inicial</option>
            <option value="2">Fase 2: Talleres de valores</option>
            <option value="3">Fase 3: Grupo establecido</option>
          </select>
          <button disabled={saving} className="btn-primary justify-center">
            <Plus className="w-4 h-4" /> Registrar institución
          </button>
        </form>
        <form onSubmit={createStudent} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">Nuevo estudiante</h2>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              className="input-field"
              placeholder="Nombres"
              value={studentForm.nombres}
              onChange={(event) =>
                setStudentForm({ ...studentForm, nombres: event.target.value })
              }
            />
            <input
              required
              className="input-field"
              placeholder="Apellidos"
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
            <option value="">Institución</option>
            {instituciones.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.nombre}
              </option>
            ))}
          </select>
          <input
            className="input-field"
            placeholder="Grado o semestre"
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
            <option value="">Tutor o líder</option>
            {personas.map((person) => (
              <option key={person.id} value={person.id}>
                {person.nombres} {person.apellidos}
              </option>
            ))}
          </select>
          <button disabled={saving} className="btn-secondary justify-center">
            <Plus className="w-4 h-4" /> Registrar estudiante
          </button>
        </form>
        <form onSubmit={createGroup} className={`card p-5 flex flex-col gap-2 ${canEdit ? '' : 'hidden'}`}>
          <h2 className="font-medium">Nuevo grupo REFAM</h2>
          <input
            required
            className="input-field"
            placeholder="Nombre del grupo"
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
            <option value="">Institución de origen</option>
            {instituciones.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.nombre}
              </option>
            ))}
          </select>
          <input
            className="input-field"
            placeholder="Dirección de reunión"
            value={groupForm.direccion}
            onChange={(event) =>
              setGroupForm({ ...groupForm, direccion: event.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              min="1"
              type="number"
              placeholder="Lección actual (ej. 1)"
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
              <option value="">Líder</option>
              {personas.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.nombres} {person.apellidos}
                </option>
              ))}
            </select>
          </div>
          <button disabled={saving} className="btn-primary justify-center">
            <Plus className="w-4 h-4" /> Crear grupo
          </button>
        </form>
      </section>
    </div>
  );
}
