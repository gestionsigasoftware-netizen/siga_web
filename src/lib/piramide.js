// Piramide poblacional (edad x genero), compartida entre local, distrital
// y nacional. Cada nivel solo cambia el alcance de la consulta a
// `personas` (una congregacion, todas las de un distrito, o todo el
// pais) — el calculo de la piramide en si es siempre el mismo.

export const AGE_BRACKETS = ["0-12", "13-17", "18-29", "30-59", "60+"];

export function calcularEdad(fechaNacimiento, hoy = new Date()) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const noHaCumplido = hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (noHaCumplido) edad -= 1;
  return edad >= 0 && edad < 110 ? edad : null;
}

function bracketDe(edad) {
  return edad <= 12 ? "0-12" : edad <= 17 ? "13-17" : edad <= 29 ? "18-29" : edad <= 59 ? "30-59" : "60+";
}

// personas: [{ fecha_nacimiento, genero }], ya filtradas a activas.
export function construirPiramide(personas, hoy = new Date()) {
  const porBracket = Object.fromEntries(AGE_BRACKETS.map((bracket) => [bracket, { masculino: 0, femenino: 0 }]));
  let conGenero = 0;
  personas.forEach((persona) => {
    const edad = calcularEdad(persona.fecha_nacimiento, hoy);
    if (edad === null || (persona.genero !== "masculino" && persona.genero !== "femenino")) return;
    conGenero += 1;
    porBracket[bracketDe(edad)][persona.genero] += 1;
  });
  return { porBracket, conGenero, total: personas.length };
}

export function piramideChartData(porBracket) {
  return {
    labels: AGE_BRACKETS,
    datasets: [
      { label: "Masculino", data: AGE_BRACKETS.map((bracket) => -porBracket[bracket].masculino), backgroundColor: "#2a78d6", borderRadius: 4, barThickness: 18 },
      { label: "Femenino", data: AGE_BRACKETS.map((bracket) => porBracket[bracket].femenino), backgroundColor: "#9a6bce", borderRadius: 4, barThickness: 18 },
    ],
  };
}

export function piramideChartOptions() {
  return {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: "easeOutQuart" },
    plugins: {
      legend: { display: true, position: "top", align: "start", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, boxHeight: 7, padding: 14, color: "#52514e", font: { size: 11, weight: "500" } } },
      tooltip: { backgroundColor: "#111820", titleColor: "#ffffff", bodyColor: "rgba(255,255,255,0.78)", padding: 12, callbacks: { label: (context) => ` ${context.dataset.label}: ${Math.abs(context.parsed.x)}` } },
    },
    scales: {
      x: { stacked: true, border: { display: false }, grid: { color: "rgba(82,81,78,0.1)" }, ticks: { color: "#898781", callback: (value) => Math.abs(value), precision: 0 } },
      y: { stacked: true, border: { display: false }, grid: { display: false }, ticks: { color: "#898781" } },
    },
  };
}
