import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const RegistrarAsistencia = lazy(() => import("./pages/RegistrarAsistencia"));
const Amigos = lazy(() => import("./pages/Amigos"));
const Evangelismo = lazy(() => import("./pages/Evangelismo"));
const MisionJuvenil = lazy(() => import("./pages/MisionJuvenil"));
const Aprobaciones = lazy(() => import("./pages/Aprobaciones"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Personas = lazy(() => import("./pages/Personas"));
const Modulos = lazy(() => import("./pages/Modulos"));
const Reportes = lazy(() => import("./pages/Reportes"));
const Perfil = lazy(() => import("./pages/Perfil"));
const ConfiguracionSistema = lazy(() => import("./pages/ConfiguracionSistema"));
const Feligresia = lazy(() => import("./pages/FeligresiaAdmin"));
const AuditoriaFeligresia = lazy(() => import("./pages/AuditoriaFeligresia"));
const EquipoCongregacion = lazy(() => import("./pages/EquipoCongregacion"));
const PastoralDistrital = lazy(() => import("./pages/PastoralDistrital"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/registrar" element={<RegistrarAsistencia />} />
          <Route path="/personas" element={<Personas />} />
          <Route path="/feligresia" element={<Feligresia />} />
          <Route
            path="/auditoria-feligresia"
            element={<AuditoriaFeligresia />}
          />
          <Route path="/equipo-congregacion" element={<EquipoCongregacion />} />
          <Route path="/pastoral-distrital" element={<PastoralDistrital />} />
          <Route path="/modulos" element={<Modulos />} />
          <Route path="/amigos" element={<Amigos />} />
          <Route path="/evangelismo" element={<Evangelismo />} />
          <Route path="/mision-juvenil" element={<MisionJuvenil />} />
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
    </BrowserRouter>
  );
}
