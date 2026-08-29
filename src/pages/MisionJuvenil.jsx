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
    leccion_actual: 1,
  });

  async function load() {
    if (!congregacionId) return;
    setLoading(true);
    setError(null);
    const start = new Date();
    start.setDate(start.getDate() - Number(periodo));
    const [i, s, g, r, p] = await Promise.all([
      supabase
        .from("mision_instituciones")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .order("nombre"),
      supabase
        .from("mision_estudiantes")
        .select(
          "id, nombres, apellidos, institucion_id, grado_semestre, telefono, estado, tutor_persona_id, mision_instituciones(nombre)",
        )
        .eq("congregacion_id", congregacionId)
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
    ]);
    const failed = [i, s, g, r, p].find((item) => item.error);
    if (failed)
      setError(
        "No se pudo cargar Misión Juvenil. Intenta nuevamente o contacta al administrador.",
      );
    setInstituciones(i.data ?? []);
    setEstudiantes(s.data ?? []);
    setGrupos(g.data ?? []);
    setRegistros(r.data ?? []);
    setPersonas(p.data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [congregacionId, periodo]);
  useEffect(() => {
    if (!congregacionId) return;
    supabase.rpc("tiene_permiso", { p_congregacion_id: congregacionId, p_permiso: "mision_juvenil.editar" }).then(({ data }) => setCanEdit(Boolean(data)));
  }, [congregacionId]);
  const students = estudiantes.filter(
    (student) =>
      (institucionFiltro === "todos" ||
        student.institucion_id === institucionFiltro) &&
      (estadoFiltro === "todos" || student.estado === estadoFiltro),
  );
  const visibleRecords = registros;
  const attendance = visibleRecords.reduce(
    (sum, item) => sum + Number(item.total_asistentes || 0),
    0,
  );
  const average = visibleRecords.length
    ? Math.round(attendance / visibleRecords.length)
    : 0;
  const baptized = students.filter(
    (student) => student.estado === "bautizado",
  ).length;
  const activeSympathizers = students.filter((student) =>
    ["simpatizante", "refam", "discipulado"].includes(student.estado),
  ).length;
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
      setError(`No se pudo crear la institución: ${result.error.message}`);
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
      setError(`No se pudo registrar el estudiante: ${result.error.message}`);
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
        leccion_actual: Number(groupForm.leccion_actual),
      });
    setSaving(false);
    if (result.error)
      setError(`No se pudo crear el grupo: ${result.error.message}`);
    else {
      setNotice("Grupo juvenil registrado.");
      setGroupForm({
        nombre: "",
        institucion_id: "",
        direccion: "",
        lider_persona_id: "",
        leccion_actual: 1,
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
        <Metric label="Instituciones" value={instituciones.length} />
        <Metric label="Simpatizantes activos" value={activeSympathizers} />
        <Metric label="Grupos REFAM" value={grupos.length} />
        <Metric label="Asistencia promedio" value={average} />
        <Metric label="Bautizados" value={baptized} tone="text-success" />
        <Metric label="Capturas móviles" value={registros.length} />
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
          <label className="text-xs text-secondary">
            Estado espiritual
            <select
              className="input-field mt-1.5"
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
              data={{
                labels: trend.map((item) => item.fecha),
                datasets: [
                  {
                    label: "Asistentes",
                    data: trend.map((item) => item.total),
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
          <p className="eyebrow">Crecimiento</p>
          <h2 className="font-medium mt-1">Estado de estudiantes</h2>
          <div className="h-56 mt-4">
            <Bar
              data={{
                labels: statusRows.map((item) => item.label),
                datasets: [
                  {
                    label: "Estudiantes",
                    data: statusRows.map((item) => item.total),
                    backgroundColor: "#e06b35",
                    borderRadius: 4,
                    barThickness: 18,
                  },
                ],
              }}
              options={CHART_OPTIONS}
            />
          </div>
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
              <div key={group.id} className="py-3">
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
              </div>
            ))}
            {!grupos.length && (
              <p className="text-sm text-muted py-6">
                Aún no hay grupos registrados.
              </p>
            )}
          </div>
        </div>
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
