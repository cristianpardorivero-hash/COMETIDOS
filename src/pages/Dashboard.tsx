import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { Cometido } from '../types';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  MapPin,
  Calendar,
  Users,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatDate } from '../lib/dateUtils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';

const StatCard: React.FC<{ 
  title: string; 
  value: string | number; 
  icon: React.ElementType; 
  color: string;
  subtitle?: string;
}> = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="institutional-card p-6 flex items-start gap-4">
    <div className={`p-4 rounded-2xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</p>}
    </div>
  </div>
);

const Dashboard: React.FC<{ setActiveView: (view: string) => void }> = ({ setActiveView }) => {
  const { profile } = useAuth();
  const [, setLoading] = useState(true);
  const [recentCometidos, setRecentCometidos] = useState<Cometido[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pendientes: 0,
    aprobados: 0,
    rechazados: 0,
    totalViaticos: 0
  });

  const [chartData, setChartData] = useState<{name: string, total: number}[]>([]);
  const [pieData, setPieData] = useState<{name: string, value: number, color: string}[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!profile) return;
      setLoading(true);
      try {
        const cometidosRef = collection(db, 'cometidos');
        const userRoles = profile.roles || [];
        const isManager = userRoles.includes('Administrador') || userRoles.includes('Director') || userRoles.includes('Personal') || userRoles.includes('Finanzas');
        const isJefatura = userRoles.includes('Jefatura de Servicio');

        let q;
        if (isManager) {
          q = query(cometidosRef, orderBy('createdAt', 'desc'));
        } else if (isJefatura) {
          q = query(cometidosRef, where('servicioId', '==', profile.servicioId), orderBy('createdAt', 'desc'));
        } else {
          q = query(cometidosRef, where('funcionarioUid', '==', profile.uid), orderBy('createdAt', 'desc'));
        }

        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cometido));
        setRecentCometidos(docs.slice(0, 5));
        
        const pendientes = docs.filter(d => d.estado.includes('Pendiente') || d.estado.includes('revisión')).length;
        const aprobados = docs.filter(d => d.estado === 'Pagado' || d.estado === 'Autorizado por Dirección' || d.estado === 'Finalizado' || d.estado === 'No corresponde pago').length;
        const rechazados = docs.filter(d => d.estado.includes('Rechazado')).length;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const totalViáticos = docs
          .filter(d => d.estado === 'Pagado')
          .filter(d => {
            if (!d.createdAt) return false;
            const date = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
            return date >= thirtyDaysAgo;
          })
          .reduce((acc, curr) => acc + (curr.montoPagado || 0), 0);

        setStats({
          total: docs.length,
          pendientes,
          aprobados,
          rechazados,
          totalViaticos: totalViáticos
        });

        // Calculate bar chart data (by service)
        const serviceMap: Record<string, number> = {};
        docs.forEach(d => {
          serviceMap[d.servicioNombre] = (serviceMap[d.servicioNombre] || 0) + 1;
        });
        const formattedChartData = Object.entries(serviceMap).map(([name, total]) => ({ name, total }));
        setChartData(formattedChartData.length > 0 ? formattedChartData : [{ name: 'Sin datos', total: 0 }]);

        // Calculate pie chart data (by state groups)
        const total = docs.length;
        if (total > 0) {
          setPieData([
            { name: 'Aprobados', value: Math.round((aprobados / total) * 100), color: '#22c55e' },
            { name: 'Pendientes', value: Math.round((pendientes / total) * 100), color: '#f59e0b' },
            { name: 'Rechazados', value: Math.round((rechazados / total) * 100), color: '#ef4444' },
            { 
              name: 'Otros', 
              value: Math.max(0, 100 - (Math.round((aprobados / total) * 100) + Math.round((pendientes / total) * 100) + Math.round((rechazados / total) * 100))), 
              color: '#94a3b8' 
            }
          ].filter(p => p.value > 0));
        } else {
          setPieData([{ name: 'Sin datos', value: 100, color: '#f1f5f9' }]);
        }

      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [profile]);

  // Motion variants for staggered children
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={container} 
      className="space-y-8"
    >
      {/* Welcome Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Bienvenido, {profile?.nombre.split(' ')[0]}</h1>
           <p className="text-slate-500 mt-2 font-medium">Aquí tienes un resumen de la gestión de cometidos.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {(profile?.roles?.includes('Director') || profile?.roles?.includes('Jefatura de Servicio') || profile?.roles?.includes('Administrador')) && (
            <button 
              onClick={() => setActiveView('approvals')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-indigo-100"
            >
              <CheckCircle2 size={20} />
              Ver Aprobaciones
            </button>
          )}
          {profile?.roles?.includes('Personal') && (
            <button 
              onClick={() => setActiveView('personal')}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-emerald-100"
            >
              <Users size={20} />
              Gestión Personal
            </button>
          )}
          <button 
            onClick={() => setActiveView('my-cometidos')}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-md hover:shadow-xl hover:-translate-y-0.5"
          >
            <FileText size={20} />
            Solicitar Cometido
          </button>
        </div>
      </motion.div>

      <motion.div 
        variants={item}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard title="Total Solicitudes" value={stats.total} icon={FileText} color="bg-blue-500" />
        <StatCard title="Pendientes" value={stats.pendientes} icon={Clock} color="bg-amber-500" />
        <StatCard title="Aprobados" value={stats.aprobados} icon={CheckCircle2} color="bg-emerald-500" />
        <StatCard title="Total de Viáticos Pagados" value={`$${stats.totalViaticos.toLocaleString()}`} icon={TrendingUp} color="bg-indigo-500" subtitle="Último mes" />
      </motion.div>

      {/* Charts Section */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 institutional-card p-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Users size={20} className="text-slate-400" />
            Cometidos por Servicio
          </h3>
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 500}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 500}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 600}} />
                <Bar dataKey="total" fill="#334155" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="institutional-card p-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-slate-400" />
            Estado General
          </h3>
          <div className="flex-1 w-full relative min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '8px 16px', fontWeight: 600}}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className="text-center mt-1">
                 <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                   {stats.total > 0 ? Math.round((stats.aprobados / stats.total) * 100) : 0}%
                 </p>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Aprobados</p>
               </div>
            </div>
          </div>
          <div className="mt-6 space-y-3 bg-slate-50 p-4 rounded-2xl">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: item.color}} />
                  <span className="text-sm font-semibold text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={item} className="institutional-card">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
           <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <AlertCircle size={20} className="text-slate-400" />
              Actividad Reciente
           </h3>
           <button onClick={() => setActiveView('my-cometidos')} className="text-slate-900 text-sm font-bold hover:bg-slate-100 px-4 py-2 rounded-xl transition-colors">Ver todo</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                <th className="px-6 py-4 rounded-tl-2xl">ID</th>
                <th className="px-6 py-4">Tipo / Destino</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentCometidos.length > 0 ? recentCometidos.map(cometido => (
                <tr key={cometido.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 text-xs font-mono text-slate-400 font-medium">#{cometido.id.substring(0, 6)}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{cometido.tipoCometido}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-semibold bg-slate-100 w-fit px-2 py-0.5 rounded-md">
                        <MapPin size={12} className="text-blue-500" /> {cometido.ciudad}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <Calendar size={14} className="text-blue-500" /> {formatDate(cometido.fechaInicio)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold ml-5 uppercase">Desde las {cometido.horaInicio}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`status-badge ${
                      cometido.estado.includes('Aprobado') || cometido.estado.includes('Autorizado') 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : cometido.estado.includes('Pendiente')
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {cometido.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-300 hover:text-slate-900 hover:bg-slate-100 p-2 rounded-xl transition-all">
                       <ChevronRight size={20} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium bg-slate-50/30">No hay solicitudes recientes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
