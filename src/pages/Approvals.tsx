import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Cometido, Reemplazo } from '../types';
import { Eye, MapPin, CheckCircle2, Clock, UserPlus, Calendar, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/dateUtils';
import CometidoDetail from '../components/CometidoDetail';
import ReemplazoEvalModal from '../components/ReemplazoEvalModal';

import { sendNotification } from '../lib/notifications';

interface ApprovalsProps {
  viewRole: 'Jefatura' | 'Personal' | 'Finanzas';
}

const Approvals: React.FC<ApprovalsProps> = ({ viewRole }) => {
  const { profile } = useAuth();
  const [cometidos, setCometidos] = useState<Cometido[]>([]);
  const [reemplazos, setReemplazos] = useState<Reemplazo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCometido, setSelectedCometido] = useState<Cometido | null>(null);
  const [selectedReemplazo, setSelectedReemplazo] = useState<Reemplazo | null>(null);
  const [filter, setFilter] = useState('pendientes');

  const fetchCometidos = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let data: Cometido[] = [];
      let reemData: Reemplazo[] = [];
      const userRoles = profile.roles || [];
      const isAdmin = userRoles.includes('Administrador');
      const isDirector = userRoles.includes('Director');

      let estadosQuery: string[] = [];
      
      if (viewRole === 'Personal') {
         estadosQuery = filter === 'procesados' 
            ? ['En revisión por Finanzas', 'Pendiente de pago', 'Pagado', 'Finalizado', 'No corresponde pago', 'Rechazado por Personal']
            : ['En revisión por Personal', 'Autorizado por Dirección'];
      } else if (viewRole === 'Finanzas') {
         estadosQuery = filter === 'procesados'
            ? ['Pagado', 'Finalizado', 'No corresponde pago', 'Rechazado por Finanzas']
            : ['En revisión por Finanzas', 'Pendiente de pago'];
      } else {
         estadosQuery = filter === 'procesados'
            ? ['Aprobado por jefatura', 'Pendiente revisión Dirección', 'Autorizado por Dirección', 'En revisión por Personal', 'En revisión por Finanzas', 'Pendiente de pago', 'Pagado', 'Finalizado', 'No corresponde pago', 'Rechazado por jefatura', 'Devuelto por jefatura', 'Rechazado por Dirección', 'Devuelto por Dirección', 'Devuelto para corrección', 'Rechazado']
            : ['Pendiente revisión jefatura', 'Pendiente revisión Dirección'];
      }

      if (isAdmin) {
         const q = query(collection(db, 'cometidos'), where('estado', 'in', estadosQuery));
         const snap = await getDocs(q);
         data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cometido));
      } else {
        if (viewRole === 'Jefatura') {
          const promises = [];
          
          if (userRoles.includes('Jefatura de Servicio')) {
            const qJefatura = filter === 'procesados'
              ? query(collection(db, 'cometidos'), where('jefaturaUid', '==', profile.uid), where('estado', 'in', estadosQuery))
              : query(collection(db, 'cometidos'), where('jefaturaUid', '==', profile.uid), where('estado', '==', 'Pendiente revisión jefatura'));
            promises.push(getDocs(qJefatura));
          }
          
          if (userRoles.includes('Director')) {
            const qDirector = filter === 'procesados'
              ? query(collection(db, 'cometidos'), where('estado', 'in', estadosQuery))
              : query(collection(db, 'cometidos'), where('estado', '==', 'Pendiente revisión Dirección'));
            promises.push(getDocs(qDirector));
          }
          
          const snaps = await Promise.all(promises);
          const rawData = snaps.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cometido)));
          
          const uniqueIds = new Set();
          for (const doc of rawData) {
            if (!uniqueIds.has(doc.id)) {
              uniqueIds.add(doc.id);
              data.push(doc);
            }
          }
        } 
        else if ((viewRole === 'Personal' && userRoles.includes('Personal')) || (viewRole === 'Finanzas' && userRoles.includes('Finanzas'))) {
          const q = query(collection(db, 'cometidos'), where('estado', 'in', estadosQuery));
          const snap = await getDocs(q);
          data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cometido));
        }
      }

      // Fetch Reemplazos if Director or Admin
      if (viewRole === 'Jefatura' && (isDirector || isAdmin)) {
        let reemplazoEstados = filter === 'procesados'
          ? ['Aprobado por Dirección', 'Rechazado por Dirección', 'Recibido por Personal', 'Procesado']
          : ['Pendiente revisión Dirección'];
        
        const qReem = query(collection(db, 'reemplazos'), where('estado', 'in', reemplazoEstados));
        const snapReem = await getDocs(qReem);
        reemData = snapReem.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reemplazo));
      }

      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      reemData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      setCometidos(data);
      setReemplazos(reemData);
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCometidos();
  }, [profile, viewRole, filter]);

  const getHeader = () => {
    switch (viewRole) {
      case 'Personal': return { title: 'Gestión de Personal', desc: 'Revise y autorice los cometidos desde la perspectiva de recursos humanos.' };
      case 'Finanzas': return { title: 'Gestión de Finanzas', desc: 'Controle los pagos y viáticos de los cometidos aprobados.' };
      default: return { title: 'Aprobaciones Pendientes', desc: 'Gestione las solicitudes que requieren su autorización.' };
    }
  };
  const { title, desc } = getHeader();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-slate-500 font-medium mt-1">{desc}</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl w-fit shadow-sm">
         {['pendientes', 'procesados'].map(f => (
           <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${filter === f ? 'bg-slate-900 shadow-md text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
           >
             {f}
           </button>
         ))}
      </motion.div>

      <motion.div variants={itemVariants} className="institutional-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                <th className="px-6 py-4 rounded-tl-2xl">Tipo / Ref</th>
                <th className="px-6 py-4">Funcionario / Motivo</th>
                <th className="px-6 py-4 text-center">Periodo</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-6 h-20 bg-white border-b border-slate-50" />
                  </tr>
                ))
              ) : (cometidos.length > 0 || reemplazos.length > 0) ? (
                <>
                  {/* Render Cometidos */}
                  {cometidos.map((cometido, i) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={cometido.id} 
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                              <FileText size={16} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cometido</p>
                              <p className="text-xs font-bold text-slate-600">{cometido.id.slice(0, 8)}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-slate-900">{cometido.nombreFuncionario}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                           {cometido.motivo} - {cometido.ciudad}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <div className="inline-flex flex-col items-center bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 shadow-sm">
                            <p className="text-sm font-black text-indigo-900">{formatDate(cometido.fechaInicio)}</p>
                            <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold uppercase mt-1">
                               <Clock size={10} /> {cometido.horaInicio} hrs
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <span className={`status-badge px-4 py-1.5 font-extrabold ${
                            cometido.estado.includes('Pendiente') ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                            cometido.estado.includes('Aprobado') || cometido.estado.includes('Autorizado') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                         } shadow-sm`}>
                            {cometido.estado}
                         </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                         <button 
                          onClick={() => setSelectedCometido(cometido)}
                          className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-md shadow-slate-200"
                         >
                            <Eye size={16} /> Gestionar
                         </button>
                      </td>
                    </motion.tr>
                  ))}

                  {/* Render Reemplazos */}
                  {reemplazos.map((reemplazo, i) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (cometidos.length + i) * 0.05 }}
                      key={reemplazo.id} 
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                              <UserPlus size={16} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reemplazo</p>
                              <p className="text-xs font-bold text-slate-600">{reemplazo.id.slice(0, 8)}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-slate-900">{reemplazo.nombreFuncionario}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                           Reemplaza por {reemplazo.motivo}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <div className="inline-flex flex-col items-center bg-purple-50 px-4 py-2 rounded-2xl border border-purple-100 shadow-sm">
                            <p className="text-sm font-black text-purple-900">{formatDate(reemplazo.fechaInicio)}</p>
                            <div className="flex items-center gap-1 text-[10px] text-purple-500 font-bold uppercase mt-1">
                               <Calendar size={10} /> Hasta {formatDate(reemplazo.fechaTermino)}
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <span className={`status-badge px-4 py-1.5 font-extrabold ${
                            reemplazo.estado.includes('Pendiente') ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                            reemplazo.estado.includes('Aprobado') || reemplazo.estado.includes('Autorizado') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                         } shadow-sm`}>
                            {reemplazo.estado}
                         </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                         <button 
                          onClick={() => setSelectedReemplazo(reemplazo)}
                          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-md shadow-indigo-200"
                         >
                            <Eye size={16} /> Evaluar
                         </button>
                      </td>
                    </motion.tr>
                  ))}
                </>
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                     <div className="max-w-xs mx-auto">
                        <div className="bg-slate-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-slate-300">
                           <CheckCircle2 size={40} />
                        </div>
                        <h3 className="text-slate-900 font-extrabold text-xl tracking-tight">Todo al día</h3>
                        <p className="text-sm font-medium text-slate-500 mt-2">No hay solicitudes pendientes de su aprobación en este momento.</p>
                     </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedCometido && (
          <CometidoDetail 
            cometido={selectedCometido} 
            onClose={() => setSelectedCometido(null)} 
            onUpdate={fetchCometidos}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedReemplazo && (
          <ReemplazoEvalModal 
            reemplazo={selectedReemplazo}
            onClose={() => setSelectedReemplazo(null)}
            onSuccess={() => {
              setSelectedReemplazo(null);
              fetchCometidos();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Approvals;
