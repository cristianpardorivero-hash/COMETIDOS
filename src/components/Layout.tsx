import React from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType, logout } from '../lib/firebase';
import { Notificacion } from '../types';
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  Users, 
  Settings, 
  LogOut, 
  Bell,
  Menu,
  X,
  Hospital,
  Briefcase,
  DollarSign,
  UserPlus,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SidebarItem: React.FC<{ 
  icon: React.ElementType; 
  label: string; 
  active?: boolean;
  onClick: () => void;
  collapsed?: boolean;
}> = ({ icon: Icon, label, active, onClick, collapsed }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
      active 
        ? 'bg-blue-50 text-blue-700' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <Icon size={20} />
    {!collapsed && <span className="font-medium">{label}</span>}
    {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
  </button>
);

const Layout: React.FC<{ 
  children: React.ReactNode;
  activeView: string;
  setActiveView: (view: any) => void;
}> = ({ children, activeView, setActiveView }) => {
  const { user, profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notificacion[]>([]);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleToast = (e: any) => {
      setToastMessage(e.detail);
      setTimeout(() => setToastMessage(null), 4000);
    };
    window.addEventListener('show-toast', handleToast);
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  React.useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notificaciones'), 
      where('usuarioUid', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => doc.data() as Notificacion);
      setNotifications(notifs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notificaciones');
    });

    return () => unsubscribe();
  }, [profile]);

  const unreadCount = notifications.filter(n => !n.leida).length;

  const handleNotificationClick = async (notif: Notificacion) => {
    if (!notif.leida) {
      try {
        await updateDoc(doc(db, 'notificaciones', notif.id), { leida: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'notificaciones');
      }
    }
    setNotificationsOpen(false);
    if (notif.link) {
      if (notif.link.includes('apr')) {
        setActiveView('approvals');
      } else if (notif.link.includes('reem')) {
        setActiveView('reemplazos');
      } else {
        setActiveView('my-cometidos');
      }
    }
  };

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my-cometidos', label: 'Mis Cometidos', icon: FileText },
    { id: 'calendario', label: 'Calendario', icon: Calendar },
    { id: 'approvals', label: 'Aprobaciones', icon: CheckSquare, roles: ['Jefatura de Servicio', 'Director', 'Administrador'] },
    { id: 'reemplazos', label: 'Reemplazos', icon: UserPlus, roles: ['Jefatura de Servicio', 'Director', 'Personal', 'Administrador'] },
    { id: 'personal', label: 'Gestión Personal', icon: Briefcase, roles: ['Personal', 'Administrador'] },
    { id: 'finanzas', label: 'Gestión Finanzas', icon: DollarSign, roles: ['Finanzas', 'Administrador'] },
    { id: 'users', label: 'Usuarios', icon: Users, roles: ['Administrador'] },
    { id: 'settings', label: 'Configuración', icon: Settings, roles: ['Administrador'] },
  ];

  const filteredNav = navigation.filter(item => !item.roles || (profile && profile.roles?.some(r => item.roles?.includes(r))));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 80 }}
        className="hidden md:flex flex-col bg-white border-r border-slate-200 overflow-hidden"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Hospital size={24} />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="font-bold text-slate-900 text-lg">Hospital Curepto</h1>
              <p className="text-xs text-slate-500 font-medium tracking-tight">Gestión de Cometidos</p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4">
          {filteredNav.map(item => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeView === item.id}
              onClick={() => setActiveView(item.id)}
              collapsed={!sidebarOpen}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-bottom border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-500"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-slate-800 capitalize">
              {navigation.find(n => n.id === activeView)?.label || activeView}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>
              
              <AnimatePresence>
                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setNotificationsOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-30"
                    >
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800">Notificaciones</h3>
                        {unreadCount > 0 && (
                          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {unreadCount} nuevas
                          </span>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-500 text-sm font-medium">
                            No tienes notificaciones recientes.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-50">
                            {notifications.map(notif => (
                              <div 
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${!notif.leida ? 'bg-blue-50/30' : ''}`}
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <h4 className={`text-sm ${!notif.leida ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                    {notif.titulo}
                                  </h4>
                                  {!notif.leida && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />}
                                </div>
                                <p className="text-xs text-slate-500 font-medium line-clamp-2">{notif.mensaje}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            <div className="h-8 w-px bg-slate-200 mx-2" />

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-slate-900 leading-none">{user?.displayName}</p>
                <p className="text-xs text-slate-500 mt-1 truncate max-w-full text-center px-2">{profile?.roles?.join(', ') || 'Visitante'}</p>
              </div>
              <img 
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=random`} 
                alt="Avatar"
                className="h-9 w-9 rounded-full ring-2 ring-slate-100"
              />
              <button 
                onClick={() => logout(user?.uid?.startsWith('cu_'))}
                className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-50 md:hidden p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-2">
                    <Hospital className="text-blue-600" />
                    <span className="font-bold text-lg">Hospital Curepto</span>
                 </div>
                 <button onClick={() => setMobileMenuOpen(false)}>
                   <X />
                 </button>
              </div>
              <nav className="space-y-2">
                {filteredNav.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${
                      activeView === item.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'
                    }`}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-xl font-bold text-sm flex items-center gap-3 z-[60] pointer-events-none"
          >
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shrink-0">
              <CheckSquare size={14} className="text-white" />
            </div>
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;
