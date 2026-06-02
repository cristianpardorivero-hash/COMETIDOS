import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyCometidos from './pages/MyCometidos';
import Approvals from './pages/Approvals';
import Users from './pages/Users';
import Settings from './pages/Settings';
import ProfileSetup from './pages/ProfileSetup';
import Reemplazos from './pages/Reemplazos';
import GestionPersonal from './pages/GestionPersonal';
import { Calendario } from './pages/Calendario';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PublicVerify from './pages/PublicVerify';
import { PushNotificationManager } from './components/PushNotificationManager';

const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4 mx-auto"></div>
          <p className="text-slate-500 font-medium">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // If user is logged in but has no profile (first time), force profile setup
  // Or if some mandatory fields like RUT/Servicio are missing
  if (!profile || !profile.rut || !profile.servicioId) {
    return <ProfileSetup />;
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard setActiveView={setActiveView} />;
      case 'my-cometidos': return <MyCometidos />;
      case 'calendario': return <Calendario />;
      case 'approvals': return <Approvals viewRole="Jefatura" />;
      case 'reemplazos': return <Reemplazos />;
      case 'personal': return <GestionPersonal />;
      case 'finanzas': return <Approvals viewRole="Finanzas" />;
      case 'users': return <Users />;
      case 'settings': return <Settings />;
      default: return <Dashboard setActiveView={setActiveView} />;
    }
  };

  return (
    <>
      <PushNotificationManager />
      <Layout activeView={activeView} setActiveView={setActiveView}>
        {renderView()}
      </Layout>
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/verify/:id" element={<PublicVerify />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
