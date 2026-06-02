import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Reemplazo, UserProfile } from '../types';
import { UserPlus, Search, Filter, ChevronRight, Calendar, User, FileText, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/dateUtils';
import ReemplazoForm from '../components/ReemplazoForm';
import ReemplazoEvalModal from '../components/ReemplazoEvalModal';

export default function Reemplazos() {
  const { profile } = useAuth();
  const [reemplazos, setReemplazos] = useState<Reemplazo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showForm, setShowForm] = useState(false);
  const [evalReemplazo, setEvalReemplazo] = useState<Reemplazo | null>(null);
  const [selectedReemplazo, setSelectedReemplazo] = useState<Reemplazo | null>(null);

  // We should determine the user's role logic here
  const isDirector = profile?.roles?.includes('Director') || profile?.roles?.includes('Administrador');
  const isPersonal = profile?.roles?.includes('Personal') || profile?.roles?.includes('Administrador');
  const isJefatura = profile?.roles?.includes('Jefatura de Servicio') || profile?.roles?.includes('Administrador');

  const fetchReemplazos = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'reemplazos'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => doc.data() as Reemplazo);

      // Filter locally for now
      let filtered = data;
      if (!isDirector && !isPersonal) {
        // Only Jefatura
        filtered = filtered.filter(r => r.jefaturaUid === profile.uid);
      } else if (isDirector && !isPersonal && !isJefatura) {
         // Director
        filtered = filtered.filter(r => r.estado !== 'Borrador');
      }

      setReemplazos(filtered);
    } catch (error) {
       console.error("Error fetching reemplazos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReemplazos();
  }, [profile]);

  const handleAction = async (reemplazo: Reemplazo, action: string) => {
    let updateData: any = { updatedAt: serverTimestamp() };
    
    if (action === 'aprobarDirector') {
      updateData.estado = 'Aprobado por Dirección';
      updateData.decisionDirector = 'Autorizado';
      updateData.fechaDecisionDirector = serverTimestamp();
      updateData.nombreDirector = profile?.nombre;
    } else if (action === 'rechazarDirector') {
      updateData.estado = 'Rechazado por Dirección';
      updateData.decisionDirector = 'Rechazado';
      updateData.fechaDecisionDirector = serverTimestamp();
      updateData.nombreDirector = profile?.nombre;
    } else if (action === 'recepcionar') {
      updateData.estado = 'Recibido por Personal';
      updateData.recepcionadoPersonal = true;
      updateData.fechaRecepcionPersonal = serverTimestamp();
    } else if (action === 'procesar') {
      updateData.estado = 'Procesado';
      updateData.procesadoPersonal = true;
      updateData.fechaProcesadoPersonal = serverTimestamp();
    }

    try {
      await updateDoc(doc(db, 'reemplazos', reemplazo.id), updateData);
      fetchReemplazos();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'reemplazos');
    }
  };

  const filteredReemplazos = reemplazos.filter(r => {
    const matchesSearch = 
      r.nombreFuncionario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.nombreReemplazante.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'Todos' || r.estado === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (estado: string) => {
    if (estado.includes('Pendiente')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (estado.includes('Aprobado') || estado === 'Procesado') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (estado.includes('Rechazado')) return 'bg-red-100 text-red-800 border-red-200';
    if (estado.includes('Recibido')) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Solicitudes de Reemplazo</h1>
          <p className="text-slate-500 font-medium">Gestione las solicitudes de reemplazo del personal</p>
        </div>
        {isJefatura && (
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 active:scale-95"
          >
            <UserPlus size={18} />
            Nueva Solicitud
          </button>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por funcionario o reemplazante..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100 w-full md:w-auto overflow-x-auto">
          {['Todos', 'Pendiente revisión Dirección', 'Aprobado por Dirección', 'Procesado'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                statusFilter === status 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
              }`}
            >
              {status === 'Pendiente revisión Dirección' ? 'Pendientes' : status === 'Aprobado por Dirección' ? 'Aprobados' : status}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="institutional-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent flex mx-auto rounded-full mb-4"></div>
            <p className="text-slate-500 font-medium">Cargando solicitudes...</p>
          </div>
        ) : filteredReemplazos.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <UserPlus size={32} className="text-slate-400" />
            </div>
            <p className="font-medium text-lg text-slate-600">No hay solicitudes encontradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Funcionario a Reemplazar</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Reemplazante</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Período</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Estado</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReemplazos.map((reemplazo) => (
                  <tr key={reemplazo.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{reemplazo.nombreFuncionario}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{reemplazo.cargoFuncionario}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{reemplazo.nombreReemplazante}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5 RUT">{reemplazo.rutReemplazante}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">
                          {formatDate(reemplazo.fechaInicio)} - {formatDate(reemplazo.fechaTermino)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(reemplazo.estado)}`}>
                        {reemplazo.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* En esta página solo mostramos el estado. Las acciones de aprobación y procesamiento se movieron a sus respectivas secciones */}
                      <button 
                        onClick={() => setSelectedReemplazo(reemplazo)}
                        className="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-bold transition-colors"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedReemplazo && (
          <ReemplazoEvalModal 
            reemplazo={selectedReemplazo}
            onClose={() => setSelectedReemplazo(null)}
            onSuccess={() => {
              setSelectedReemplazo(null);
              fetchReemplazos();
            }}
            readOnly={!isDirector || selectedReemplazo.estado !== 'Pendiente revisión Dirección'}
          />
        )}
      </AnimatePresence>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ReemplazoForm 
            onClose={() => setShowForm(false)} 
            onSuccess={() => {
              setShowForm(false);
              fetchReemplazos();
            }} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {evalReemplazo && (
          <ReemplazoEvalModal 
            reemplazo={evalReemplazo}
            onClose={() => setEvalReemplazo(null)}
            onSuccess={() => {
              setEvalReemplazo(null);
              fetchReemplazos();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
