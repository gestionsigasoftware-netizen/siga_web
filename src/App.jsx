import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RegistrarAsistencia from './pages/RegistrarAsistencia'
import Amigos from './pages/Amigos'
import Aprobaciones from './pages/Aprobaciones'
import Configuracion from './pages/Configuracion'
import Personas from './pages/Personas'
import Modulos from './pages/Modulos'
import Reportes from './pages/Reportes'
import Perfil from './pages/Perfil'
import ConfiguracionSistema from './pages/ConfiguracionSistema'
import Feligresia from './pages/FeligresiaAdmin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

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
          <Route path="/modulos" element={<Modulos />} />
          <Route path="/amigos" element={<Amigos />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/configuracion-sistema" element={<ConfiguracionSistema />} />
          <Route path="/aprobaciones" element={<Aprobaciones />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
