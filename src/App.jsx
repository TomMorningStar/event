import { Routes, Route, Navigate } from 'react-router-dom'
import Public from './pages/Public.jsx'
import Login from './pages/Login.jsx'
import Admin from './pages/Admin.jsx'
import Clients from './pages/Clients.jsx'
import Fair from './pages/Fair.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Public />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/admin/clients" element={<Clients />} />
      <Route path="/fair" element={<Fair />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
