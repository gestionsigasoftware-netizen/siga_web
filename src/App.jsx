import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute";

const Login = lazy(() => import("./pages/Login"));
const InicioPublico = lazy(() => import("./pages/InicioPublico"));
const Ayuda = lazy(() => import("./pages/Ayuda"));
const Legal = lazy(() => import("./pages/Legal"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const RegistrarAsistencia = lazy(() => import("./pages/RegistrarAsistencia"));
const Amigos = lazy(() => import("./pages/Amigos"));
const Evangelismo = lazy(() => import("./pages/Evangelismo"));
const MisionesEvangelismo = lazy(() => import("./pages/MisionesEvangelismo"));
const MisionJuvenil = lazy(() => import("./pages/MisionJuvenil"));
const Esfob = lazy(() => import("./pages/Esfob"));
const Discipulado = lazy(() => import("./pages/Discipulado"));
const Aprobaciones = lazy(() => import("./pages/Aprobaciones"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Personas = lazy(() => import("./pages/Personas"));
const Modulos = lazy(() => import("./pages/Modulos"));
const Reportes = lazy(() => import("./pages/ReportesOptimizado"));
const Perfil = lazy(() => import("./pages/Perfil"));
const ConfiguracionSistema = lazy(() => import("./pages/ConfiguracionSistema"));
const Feligresia = lazy(() => import("./pages/FeligresiaAdmin"));
const RedFamilias = lazy(() => import("./pages/RedFamilias"));
const AuditoriaFeligresia = lazy(() => import("./pages/AuditoriaFeligresia"));
const EquipoCongregacion = lazy(() => import("./pages/EquipoCongregacion"));
const PastoralDistrital = lazy(() => import("./pages/PastoralDistrital"));
const GestionDistritos = lazy(() => import("./pages/GestionDistritos"));

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-sm text-secondary">
            Cargando...
          </div>
        }
      >
        <Routes>
        <Route path="/" element={<InicioPublico />} />
        <Route path="/ayuda" element={<Ayuda />} />
        <Route path="/legal" element={<Legal />} />
        <Route
          path="/login"
          element={
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center text-sm text-secondary">
                  Cargando...
                </div>
              }
            >
              <Login />
            </Suspense>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/app" element={<Dashboard />} />
          <Route path="/registrar" element={<RegistrarAsistencia />} />
          <Route path="/personas" element={<Personas />} />
          <Route path="/feligresia" element={<Feligresia />} />
          <Route path="/red-familias" element={<RedFamilias />} />
          <Route
            path="/auditoria-feligresia"
            element={<AuditoriaFeligresia />}
          />
          <Route path="/equipo-congregacion" element={<EquipoCongregacion />} />
          <Route path="/pastoral-distrital" element={<PastoralDistrital />} />
          <Route path="/distritos" element={<GestionDistritos />} />
          <Route path="/modulos" element={<Modulos />} />
          <Route path="/amigos" element={<Amigos />} />
          <Route path="/misiones-evangelismo" element={<MisionesEvangelismo />} />
          <Route path="/evangelismo" element={<Evangelismo />} />
          <Route path="/mision-juvenil" element={<MisionJuvenil />} />
          <Route path="/esfob" element={<Esfob />} />
          <Route path="/discipulado" element={<Discipulado />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route
            path="/configuracion-sistema"
            element={<ConfiguracionSistema />}
          />
          <Route path="/aprobaciones" element={<Aprobaciones />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
