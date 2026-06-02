import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Cometido, Reemplazo } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, CheckCircle, Clock, FileText, UserPlus, Calendar, Eye, Download } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';
import CometidoDetail from '../components/CometidoDetail';
import ReemplazoEvalModal from '../components/ReemplazoEvalModal';
import PDFPreviewModal from '../components/PDFPreviewModal';

export default function GestionPersonal() {
  const { profile } = useAuth();
  const [cometidos, setCometidos] = useState<Cometido[]>([]);
  const [reemplazos, setReemplazos] = useState<Reemplazo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCometido, setSelectedCometido] = useState<Cometido | null>(null);
  const [selectedReemplazo, setSelectedReemplazo] = useState<Reemplazo | null>(null);
  const [selectedPdfCometido, setSelectedPdfCometido] = useState<Cometido | null>(null);
  const [selectedPdfReemplazo, setSelectedPdfReemplazo] = useState<Reemplazo | null>(null);
  const [filter, setFilter] = useState<'pendientes' | 'procesados'>('pendientes');

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Fetch Approved Cometidos for Personnel
      const cometidosEstados = filter === 'pendientes' 
        ? ['Autorizado por Dirección', 'En revisión por Personal']
        : ['En revisión por Finanzas', 'Pendiente de pago', 'Pagado', 'Finalizado', 'No corresponde pago', 'Rechazado por Personal'];
      
      const qCom = query(collection(db, 'cometidos'), where('estado', 'in', cometidosEstados));
      const snapCom = await getDocs(qCom);
      const comData = snapCom.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cometido));

      // Fetch Approved Reemplazos for Personnel
      const reemplazoEstados = filter === 'pendientes'
        ? ['Aprobado por Dirección', 'Recibido por Personal']
        : ['Procesado'];
      
      const qReem = query(collection(db, 'reemplazos'), where('estado', 'in', reemplazoEstados));
      const snapReem = await getDocs(qReem);
      const reemData = snapReem.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reemplazo));

      comData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      reemData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      setCometidos(comData);
      setReemplazos(reemData);
    } catch (error) {
      console.error("Error fetching data for Personal:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile, filter]);

  const handleProcessReemplazo = async (reemplazo: Reemplazo) => {
    try {
      await updateDoc(doc(db, 'reemplazos', reemplazo.id), {
        estado: 'Procesado',
        procesadoPersonal: true,
        fechaProcesadoPersonal: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'reemplazos');
    }
  };

  const filteredCometidos = cometidos.filter(c => 
    c.nombreFuncionario.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredReemplazos = reemplazos.filter(r => 
    r.nombreFuncionario.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.nombreReemplazante.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestión de Personal</h1>
          <p className="text-slate-500 font-medium">Procesamiento de Solicitudes Aprobadas</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
          <button 
            onClick={() => setFilter('pendientes')}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${filter === 'pendientes' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500'}`}
          >
            Pendientes
          </button>
          <button 
            onClick={() => setFilter('procesados')}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${filter === 'procesados' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500'}`}
          >
            Procesados
          </button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar funcionario o solicitud..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 transition-all font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="institutional-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Tipo / Ref</th>
                <th className="px-6 py-4">Funcionario</th>
                <th className="px-6 py-4">Detalle</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500">Cargando datos...</td></tr>
              ) : (filteredCometidos.length === 0 && filteredReemplazos.length === 0) ? (
                <tr><td colSpan={5} className="p-20 text-center text-slate-500 font-bold">No hay solicitudes para mostrar</td></tr>
              ) : (
                <>
                  {filteredCometidos.map(cometido => (
                    <tr key={cometido.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText size={16} /></div>
                          <span className="text-xs font-bold text-slate-500">COM-{cometido.id.slice(0,6)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">{cometido.nombreFuncionario}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{cometido.servicioNombre}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-700">{cometido.motivo}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(cometido.fechaInicio)}</p>
                        {cometido.resolucionAdministrativa && filter === 'procesados' && (
                          <div className="mt-1 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-blue-100">
                            Res: {cometido.resolucionAdministrativa}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase border border-emerald-100">
                          {cometido.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setSelectedPdfCometido(cometido)}
                            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                            title="Ver PDF"
                          >
                            <Download size={16} />
                          </button>
                          <button 
                            onClick={() => setSelectedCometido(cometido)}
                            className="p-2 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200 hover:scale-105 transition-transform"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredReemplazos.map(reemplazo => (
                    <tr key={reemplazo.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><UserPlus size={16} /></div>
                          <span className="text-xs font-bold text-slate-500">REE-{reemplazo.id.slice(0,6)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">{reemplazo.nombreFuncionario}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">REEMPLAZADO POR {reemplazo.nombreReemplazante}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-700">{reemplazo.motivo}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(reemplazo.fechaInicio)} - {formatDate(reemplazo.fechaTermino)}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase border border-blue-100">
                          {reemplazo.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setSelectedPdfReemplazo(reemplazo)}
                            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                            title="Ver PDF"
                          >
                            <Download size={16} />
                          </button>
                          <button 
                            onClick={() => setSelectedReemplazo(reemplazo)}
                            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                          >
                            <Eye size={16} />
                          </button>
                          {filter === 'pendientes' && (
                            <button 
                              onClick={() => handleProcessReemplazo(reemplazo)}
                              className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-200 hover:scale-105 transition-transform flex items-center gap-1"
                            >
                              <CheckCircle size={14} /> Procesar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
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
            onUpdate={fetchData}
          />
        )}
        {selectedReemplazo && (
          <ReemplazoEvalModal 
            reemplazo={selectedReemplazo}
            onClose={() => setSelectedReemplazo(null)}
            onSuccess={() => {
              setSelectedReemplazo(null);
              fetchData();
            }}
          />
        )}
        {selectedPdfCometido && (
          <PDFPreviewModal 
            cometido={selectedPdfCometido}
            isOpen={!!selectedPdfCometido}
            onClose={() => setSelectedPdfCometido(null)}
            type="solicitud"
          />
        )}
        {selectedPdfReemplazo && (
          <PDFPreviewModal 
            reemplazo={selectedPdfReemplazo}
            isOpen={!!selectedPdfReemplazo}
            onClose={() => setSelectedPdfReemplazo(null)}
            type="reemplazo"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
