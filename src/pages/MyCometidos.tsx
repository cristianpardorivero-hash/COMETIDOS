import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Cometido } from '../types';
import { Plus, Search, Filter, ChevronRight, MapPin, Calendar, FileText, FilePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/dateUtils';
import CometidoForm from '../components/CometidoForm';
import CometidoDetail from '../components/CometidoDetail';

const CometidoProgress = ({ estado }: { estado: string }) => {
  const steps = [
    { label: 'Jefat.', key: 'jef' },
    { label: 'Direcc.', key: 'dir' },
    { label: 'Pers.', key: 'per' },
    { label: 'Finanz.', key: 'fin' },
  ];

  let currentStep = 0;
  let stepStatus = 'current'; 

  if (estado === 'Pendiente revisión jefatura' || estado === 'Borrador') {
    currentStep = 0; stepStatus = 'current';
  } else if (estado === 'Rechazado por jefatura') {
    currentStep = 0; stepStatus = 'rejected';
  } else if (estado === 'Devuelto por jefatura') {
    currentStep = 0; stepStatus = 'returned';
  } else if (estado === 'Pendiente revisión Dirección') {
    currentStep = 1; stepStatus = 'current';
  } else if (estado === 'Rechazado por Dirección') {
    currentStep = 1; stepStatus = 'rejected';
  } else if (estado === 'Devuelto por Dirección') {
    currentStep = 1; stepStatus = 'returned';
  } else if (estado === 'Autorizado por Dirección' || estado === 'En revisión por Personal') {
    currentStep = 2; stepStatus = 'current';
  } else if (estado === 'Devuelto para corrección' || estado === 'Rechazado por Personal') {
    currentStep = 2; stepStatus = estado.includes('Devuelto') ? 'returned' : 'rejected';
  } else if (estado === 'En revisión por Finanzas' || estado === 'Pendiente de pago') {
    currentStep = 3; stepStatus = 'current';
  } else if (estado === 'Rechazado por Finanzas') {
    currentStep = 3; stepStatus = 'rejected';
  } else if (estado === 'Pagado' || estado === 'No corresponde pago' || estado === 'Finalizado') {
    currentStep = 3; stepStatus = 'completed';
  }

  const mappedSteps = steps.map((s, i) => {
    if (i < currentStep) return { ...s, status: 'completed' };
    if (i === currentStep) return { ...s, status: stepStatus };
    return { ...s, status: 'waiting' };
  });

  return (
    <div className="mt-4 bg-slate-50/50 border border-slate-100 rounded-xl p-3 group-hover:bg-white group-hover:border-slate-200 transition-colors">
      <div className="flex justify-between items-center mb-2">
         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado: {estado}</span>
         <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase ${
            stepStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
            stepStatus === 'rejected' ? 'bg-rose-100 text-rose-700' :
            stepStatus === 'returned' ? 'bg-orange-100 text-orange-700' :
            'bg-blue-100 text-blue-700'
         }`}>
            {stepStatus === 'completed' ? 'Aprobado' : stepStatus === 'rejected' ? 'Rechazado' : stepStatus === 'returned' ? 'Devuelto' : 'En Proceso'}
         </span>
      </div>
      <div className="flex items-center gap-1">
        {mappedSteps.map((step, idx) => (
          <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5 relative">
             <div className={`h-1.5 w-full rounded-full transition-colors ${
                 step.status === 'completed' ? 'bg-emerald-500' :
                 step.status === 'current' ? 'bg-blue-500 animate-pulse' :
                 step.status === 'rejected' ? 'bg-rose-500' :
                 step.status === 'returned' ? 'bg-orange-500' :
                 'bg-slate-200'
             }`} />
             <span className={`text-[9px] font-extrabold tracking-tight ${
                 step.status === 'completed' ? 'text-emerald-700' :
                 step.status === 'current' ? 'text-blue-700' :
                 step.status === 'rejected' ? 'text-rose-700' :
                 step.status === 'returned' ? 'text-orange-700' :
                 'text-slate-400'
             }`}>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MyCometidos: React.FC = () => {
  const { profile } = useAuth();
  const [cometidos, setCometidos] = useState<Cometido[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCometido, setSelectedCometido] = useState<Cometido | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCometidos = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'cometidos'), 
        where('funcionarioUid', '==', profile.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cometido));
      setCometidos(data);
    } catch (error) {
      console.error('Error fetching cometidos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCometidos();
  }, [profile]);

  const filteredCometidos = cometidos.filter(c => 
    (c.motivo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.ciudad || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.tipoCometido || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Mis Cometidos</h1>
          <p className="text-slate-500 font-medium mt-1">Gestiona tus solicitudes de actividades fuera del Hospital.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl font-bold transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
        >
          <Plus size={20} />
          Solicitar Cometido
        </button>
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-col md:flex-row gap-4 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por motivo, ciudad o tipo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-transparent text-slate-800 placeholder-slate-400 font-medium focus:outline-none"
          />
        </div>
        <div className="w-full md:w-auto flex items-center justify-end border-t md:border-t-0 md:border-l border-slate-100 pt-2 md:pt-0 pl-2">
           <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-700 font-bold transition-colors w-full md:w-auto justify-center">
             <Filter size={18} />
             Filtrar
           </button>
        </div>
      </motion.div>

      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <motion.div variants={itemVariants} key={i} className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
          ))
        ) : filteredCometidos.length > 0 ? (
          filteredCometidos.map(cometido => (
            <motion.div 
              variants={itemVariants}
              key={cometido.id}
              layoutId={cometido.id}
              onClick={() => setSelectedCometido(cometido)}
              whileHover={{ y: -4, scale: 1.01 }}
              className="group bg-white rounded-3xl border border-slate-200/60 overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-blue-900/10 hover:border-blue-200 transition-all duration-300"
            >
              <div className="p-5 flex justify-between items-center bg-gradient-to-r from-slate-50/80 to-white border-b border-slate-100/80 relative">
                 <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-r-full" />
                 <div className="flex items-center gap-3">
                    <div className="bg-white text-slate-700 p-2.5 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ring-1 ring-slate-100 group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600 group-hover:shadow-blue-500/30 transition-all">
                       <FileText size={18} />
                    </div>
                    <div>
                       <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Folio: {cometido.id.slice(0, 8)}</p>
                       <p className="text-xs font-bold text-slate-700 leading-tight mt-0.5">{cometido.tipoCometido}</p>
                    </div>
                 </div>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <h4 className="font-extrabold text-slate-900 line-clamp-2 leading-tight text-lg group-hover:text-blue-700 transition-colors">{cometido.motivo}</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2">
                   <div className="flex flex-col gap-1 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
                      <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1"><MapPin size={10}/> Destino</span>
                      <span className="text-sm font-bold text-slate-800 line-clamp-1">{cometido.ciudad}</span>
                   </div>
                   <div className="flex flex-col gap-1 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
                      <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1"><Calendar size={10}/> Fecha Inicio</span>
                      <span className="text-sm font-bold text-slate-800 line-clamp-1">{formatDate(cometido.fechaInicio)}</span>
                   </div>
                </div>

                <CometidoProgress estado={cometido.estado} />

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-2">
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide bg-slate-100 px-2 py-1 rounded-md">{cometido.medioTransporte}</span>
                   </div>
                   <div className="flex items-center text-blue-600 font-bold text-xs uppercase tracking-wide group-hover:translate-x-1 transition-transform">
                     <span>Detalle</span>
                     <ChevronRight size={14} className="ml-0.5" />
                   </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div variants={itemVariants} className="col-span-full py-24 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
             <div className="bg-slate-50 p-5 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-5 text-slate-400">
                <FileText size={36} />
             </div>
             <h3 className="text-slate-900 font-extrabold text-xl">No tienes cometidos registrados</h3>
             <p className="text-slate-500 mt-2 font-medium">Comienza creando tu primera solicitud de cometido.</p>
             <button onClick={() => setIsFormOpen(true)} className="mt-6 text-blue-600 font-bold hover:underline">Solicitar ahora</button>
          </motion.div>
        )}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {isFormOpen && (
          <CometidoForm 
            onClose={() => setIsFormOpen(false)} 
            onSuccess={() => {
              setIsFormOpen(false);
              fetchCometidos();
            }} 
          />
        )}
        {selectedCometido && (
          <CometidoDetail 
            cometido={selectedCometido} 
            onClose={() => setSelectedCometido(null)} 
            onUpdate={fetchCometidos}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MyCometidos;
