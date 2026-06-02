import React, { useState, useEffect } from 'react';
import { Bell, Shield, Database, Layout, Mail, Plus, Trash2, CheckCircle2, XCircle, DollarSign, Save, Search } from 'lucide-react';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Servicio, ViaticoValue } from '../types';
import { motion } from 'motion/react';
import { formatDate } from '../lib/dateUtils';

const SettingsItem: React.FC<{ icon: React.ElementType; title: string; desc: string; onClick?: () => void }> = ({ icon: Icon, title, desc, onClick }) => (
  <div onClick={onClick} className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer group">
    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 text-slate-400 group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
       <Icon size={20} />
    </div>
    <div>
       <h4 className="font-bold text-slate-800">{title}</h4>
       <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
  </div>
);

const Settings: React.FC = () => {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [searchTermServicio, setSearchTermServicio] = useState('');
  const [newServicio, setNewServicio] = useState('');
  const [loading, setLoading] = useState(false);
  const [servicioToDelete, setServicioToDelete] = useState<Servicio | null>(null);

  const [showRolesModal, setShowRolesModal] = useState(false);
  const [showVisualModal, setShowVisualModal] = useState(false);
  const [showViaticosModal, setShowViaticosModal] = useState(false);

  const [viaticos, setViaticos] = useState<ViaticoValue[]>([]);
  const [newViatico, setNewViatico] = useState<Partial<ViaticoValue>>({
    tramoGrado: '',
    fechaInicio: '',
    fechaTermino: '',
    valor100: 0,
    valor40: 0
  });

  // Dummy state for visual settings
  const [visualConfig, setVisualConfig] = useState({
    institutionName: 'Hospital de Curepto',
    primaryColor: '#2563eb',
    secondaryColor: '#f1f5f9',
    theme: 'light',
  });

  const fetchServicios = async () => {
    try {
      const q = query(collection(db, 'servicios'));
      const querySnapshot = await getDocs(q);
      const servs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Servicio));
      setServicios(servs);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'servicios');
    }
  };

  const fetchViaticos = async () => {
    try {
      const q = query(collection(db, 'viaticos_valores'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const vals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ViaticoValue));
      setViaticos(vals);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'viaticos_valores');
    }
  };

  useEffect(() => {
    fetchServicios();
    fetchViaticos();
  }, []);

  const handleAddServicio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServicio.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'servicios'), {
        nombre: newServicio,
        jefaturaUid: '',
        emailJefatura: '',
        activo: true
      });
      setNewServicio('');
      fetchServicios();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'servicios');
    } finally {
      setLoading(false);
    }
  };

  const toggleServicioStatus = async (servicio: Servicio) => {
    try {
      await updateDoc(doc(db, 'servicios', servicio.id), {
        activo: !servicio.activo
      });
      fetchServicios();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleDeleteServicio = async () => {
    if (!servicioToDelete) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'servicios', servicioToDelete.id));
      setServicioToDelete(null);
      fetchServicios();
    } catch (error) {
      console.error('Error deleting servicio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddViatico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newViatico.tramoGrado || !newViatico.fechaInicio || !newViatico.valor100 || !newViatico.valor40) {
      alert("Por favor complete los campos obligatorios.");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'viaticos_valores'), {
        tramoGrado: newViatico.tramoGrado,
        fechaInicio: newViatico.fechaInicio,
        fechaTermino: newViatico.fechaTermino || '',
        valor100: Number(newViatico.valor100),
        valor40: Number(newViatico.valor40),
        createdAt: serverTimestamp()
      });
      setNewViatico({
        tramoGrado: '',
        fechaInicio: '',
        fechaTermino: '',
        valor100: 0,
        valor40: 0
      });
      fetchViaticos();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'viaticos_valores');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteViatico = async (id: string) => {
    if (!window.confirm("¿Confirma que desea eliminar este valor de viático?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'viaticos_valores', id));
      fetchViaticos();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `viaticos_valores/${id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Configuración del Sistema</h1>
        <p className="text-slate-500 font-medium">Ajustes generales, servicios y parámetros institucionales.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            <div className="institutional-card p-8">
               <div className="flex flex-col gap-5 mb-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-xl text-slate-900 tracking-tight">Servicios o Unidades</h3>
                      <p className="text-sm text-slate-500 mt-1 font-medium">Defina los servicios del hospital disponibles para los funcionarios.</p>
                    </div>
                    <form onSubmit={handleAddServicio} className="flex gap-2 w-full md:w-auto">
                       <input 
                        type="text" 
                        value={newServicio}
                        onChange={e => setNewServicio(e.target.value)}
                        placeholder="Nuevo servicio..."
                        className="px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-medium text-slate-800 w-full md:w-auto transition-all bg-slate-50 focus:bg-white"
                       />
                       <button 
                        type="submit"
                        disabled={loading}
                        className="bg-slate-900 text-white p-2 rounded-xl hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                       >
                          <Plus size={20} />
                       </button>
                    </form>
                  </div>
                  <div className="relative w-full">
                     <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input 
                       type="text" 
                       placeholder="Buscar servicio..." 
                       value={searchTermServicio}
                       onChange={e => setSearchTermServicio(e.target.value)}
                       className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-800 font-medium placeholder:text-slate-400"
                     />
                  </div>
               </div>

               <div className="space-y-3">
                  {servicios.filter(s => s.nombre.toLowerCase().includes(searchTermServicio.toLowerCase())).length > 0 ? (
                    servicios.filter(s => s.nombre.toLowerCase().includes(searchTermServicio.toLowerCase())).map(s => (
                      <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-100 transition-all">
                         <div className="flex items-center gap-3">
                            <div className={`p-1 rounded-full ${s.activo ? 'text-green-500' : 'text-slate-300'}`}>
                               <CheckCircle2 size={18} />
                            </div>
                            <span className={`font-bold text-sm ${s.activo ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{s.nombre}</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <button 
                              onClick={() => toggleServicioStatus(s)}
                              className={`p-2 rounded-lg transition-colors ${s.activo ? 'text-slate-400 hover:bg-slate-200' : 'text-blue-500 hover:bg-blue-50'}`}
                              title={s.activo ? 'Desactivar' : 'Activar'}
                            >
                               {s.activo ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                            </button>
                            <button 
                              onClick={() => setServicioToDelete(s)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                               <Trash2 size={18} />
                            </button>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-500 bg-slate-50/50 rounded-2xl font-medium">
                       {servicios.length === 0 ? "No hay servicios configurados." : "No se encontró ningún servicio que coincida con la búsqueda."}
                    </div>
                  )}
               </div>
            </div>

            <div className="institutional-card p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
               <SettingsItem icon={Layout} title="Personalización Visual" desc="Cambiar logo, colores y temas institucionales." onClick={() => setShowVisualModal(true)} />
               <SettingsItem icon={Bell} title="Notificaciones" desc="Configurar alertas por correo y notificaciones push." />
               <SettingsItem icon={Mail} title="Servidor de Correo" desc="Configuración SMTP para envío de comprobantes." />
               <SettingsItem icon={Shield} title="Roles y Permisos" desc="Definir qué puede hacer cada perfil en el flujo." onClick={() => setShowRolesModal(true)} />
               <SettingsItem icon={DollarSign} title="Valores de Viáticos" desc="Definir montos de viáticos por grado y fecha." onClick={() => setShowViaticosModal(true)} />
            </div>
         </div>

         <div className="space-y-8">
            <div className="institutional-card p-8 bg-slate-900 text-white relative overflow-hidden">
               <div className="relative z-10">
                  <div className="bg-white/10 w-fit p-3 rounded-2xl mb-6">
                    <Database size={24} className="text-blue-400" />
                  </div>
                  <h3 className="font-bold text-xl mb-2">Respaldo y Auditoría</h3>
                  <p className="text-slate-400 text-sm mb-6">Realice copias de seguridad periódicas o exporte los registros de auditoría para revisiones de contraloría.</p>
                  <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/50">Exportar Historial Completo</button>
               </div>
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Database size={160} />
               </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/50">
               <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Shield size={18} className="text-blue-600" />
                  Estado del Sistema
               </h4>
               <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                     <span className="text-slate-500">Versión</span>
                     <span className="font-mono font-bold text-slate-900">v1.2.0-stable</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                     <span className="text-slate-500">Base de datos</span>
                     <span className="flex items-center gap-2 text-green-600 font-bold">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        En línea
                     </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                     <span className="text-slate-500">Última sincronización</span>
                     <span className="font-medium text-slate-900">Hace 2 min</span>
                  </div>
               </div>
               <button className="w-full mt-8 border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">Ver Logs Técnicos</button>
            </div>
         </div>
      </div>

      {/* Delete Confirmation Modal */}
      {servicioToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center"
          >
            <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
               <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Eliminar Servicio</h3>
            <p className="text-slate-500 text-sm mb-6">
              ¿Está seguro que desea eliminar <strong>{servicioToDelete.nombre}</strong>?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setServicioToDelete(null)}
                className="flex-1 px-4 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteServicio}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Roles and Permissions Modal */}
      {showRolesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-900">Roles y Permisos</h3>
                  <p className="text-xs text-slate-500">Definición de accesos y facultades en el sistema.</p>
                </div>
              </div>
              <button onClick={() => setShowRolesModal(false)} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-2 rounded-xl transition-all border border-slate-200">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2">Funcionario</h4>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                       <li>Crea solicitudes de cometido.</li>
                       <li>Visualiza únicamente sus propias solicitudes.</li>
                       <li>Edita solicitudes sólo en fase de borrador o devolución.</li>
                    </ul>
                 </div>
                 
                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl border-l-4 border-l-indigo-500">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2">Jefatura de Servicio</h4>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                       <li>Revisa y autoriza solicitudes de las unidades a su cargo.</li>
                       <li>Define si el cometido da derecho a viático o estadía.</li>
                       <li>Puede rechazar o devolver solicitudes a los funcionarios.</li>
                    </ul>
                 </div>

                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl border-l-4 border-l-blue-500">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2">Director</h4>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                       <li>Autoridad máxima para conceder el cometido.</li>
                       <li>Revisa las solicitudes ya pre-aprobadas por las jefaturas.</li>
                       <li>Firma la autorización final del establecimiento.</li>
                    </ul>
                 </div>

                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl border-l-4 border-l-orange-500">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2">Personal</h4>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                       <li>Genera la resolución formal a partir de la autorización.</li>
                       <li>Sube el documento PDF o escaneado firmado a la plataforma.</li>
                       <li>Timbra y archiva el registro formal.</li>
                    </ul>
                 </div>

                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl border-l-4 border-l-emerald-500">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2">Finanzas</h4>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                       <li>Gestiona el abono de viáticos y pasajes.</li>
                       <li>Revisa los cometidos que tienen cobros asociados.</li>
                       <li>Actualiza el estado a "Pagado" o "Financiado".</li>
                    </ul>
                 </div>

                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl border-l-4 border-l-slate-900">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2">Administrador</h4>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                       <li>Control total sobre parámetros de sistema y servicios.</li>
                       <li>Asignación de roles a diferentes usuarios.</li>
                       <li>Visualiza la totalidad de solicitudes del establecimiento.</li>
                    </ul>
                 </div>
              </div>

              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm flex items-start gap-3 mt-4 border border-blue-100">
                <div className="mt-0.5"><Shield size={16} /></div>
                <p>
                  <strong>Nota sobre flujos transversales:</strong> Las jefaturas pueden delegar y Personal/Finanzas tienen vistas cruzadas cuando un funcionario posee 
                  múltiples cargos o un cometido depende de presupuesto particular.
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white">
              <button 
                onClick={() => setShowRolesModal(false)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all ml-auto block"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Visual Customization Modal */}
      {showVisualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                  <Layout size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-900">Personalización Visual</h3>
                  <p className="text-xs text-slate-500">Configura la apariencia y marca de la plataforma.</p>
                </div>
              </div>
              <button onClick={() => setShowVisualModal(false)} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-2 rounded-xl transition-all border border-slate-200">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre de la Institución</label>
                <input 
                  type="text"
                  value={visualConfig.institutionName}
                  onChange={e => setVisualConfig({...visualConfig, institutionName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Logo Institucional</label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <Layout size={24} />
                  </div>
                  <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">
                    Subir nueva imagen
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Color Primario</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color"
                      value={visualConfig.primaryColor}
                      onChange={e => setVisualConfig({...visualConfig, primaryColor: e.target.value})}
                      className="h-10 w-10 p-1 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="text-sm text-slate-600 font-mono">{visualConfig.primaryColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Color Secundario</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color"
                      value={visualConfig.secondaryColor}
                      onChange={e => setVisualConfig({...visualConfig, secondaryColor: e.target.value})}
                      className="h-10 w-10 p-1 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="text-sm text-slate-600 font-mono">{visualConfig.secondaryColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tema Base</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="theme" 
                      value="light"
                      checked={visualConfig.theme === 'light'}
                      onChange={e => setVisualConfig({...visualConfig, theme: e.target.value})}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm font-medium">Claro</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="theme" 
                      value="dark"
                      checked={visualConfig.theme === 'dark'}
                      onChange={e => setVisualConfig({...visualConfig, theme: e.target.value})}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm font-medium">Oscuro</span>
                  </label>
                </div>
              </div>

              <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm flex items-start gap-3 mt-4 border border-amber-100">
                <p>
                  <strong>Nota:</strong> Estos valores son de demostración. La configuración global requiere una integración centralizada para afectar todo el diseño.
                </p>
              </div>

            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button 
                onClick={() => setShowVisualModal(false)}
                className="px-6 py-3 rounded-xl font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => setShowVisualModal(false)}
                className="px-6 py-3 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all"
              >
                Guardar Cambios
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Viaticos Modal */}
      {showViaticosModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <DollarSign size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-900">Valores de Viáticos</h3>
                  <p className="text-xs text-slate-500">Gestión de montos de viático completo y parcial según tramo de grado y período.</p>
                </div>
              </div>
              <button onClick={() => setShowViaticosModal(false)} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-2 rounded-xl transition-all border border-slate-200">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto bg-slate-50/50">
               <form onSubmit={handleAddViatico} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                     <Plus size={18} className="text-blue-600" /> Nuevo Tramo de Valor
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Tramo / Grados</label>
                        <input type="text" placeholder="Ej: EUS 1 al 5" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newViatico.tramoGrado} onChange={e => setNewViatico({...newViatico, tramoGrado: e.target.value})} />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Desde Fecha</label>
                        <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newViatico.fechaInicio} onChange={e => setNewViatico({...newViatico, fechaInicio: e.target.value})} />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Hasta (opcional)</label>
                        <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newViatico.fechaTermino} onChange={e => setNewViatico({...newViatico, fechaTermino: e.target.value})} />
                     </div>
                     <div className="md:col-span-2 grid grid-cols-2 gap-2">
                        <div>
                           <label className="block text-xs font-semibold text-slate-500 mb-1">Con Pernoctación (100%)</label>
                           <input type="number" placeholder="$" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newViatico.valor100 || ''} onChange={e => setNewViatico({...newViatico, valor100: Number(e.target.value)})} />
                        </div>
                        <div>
                           <label className="block text-xs font-semibold text-slate-500 mb-1">Sin Pernoctar (40%)</label>
                           <input type="number" placeholder="$" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newViatico.valor40 || ''} onChange={e => setNewViatico({...newViatico, valor40: Number(e.target.value)})} />
                        </div>
                     </div>
                  </div>
                  <div className="flex justify-end mt-4">
                     <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2">
                        <Save size={16} /> Guardar Valor
                     </button>
                  </div>
               </form>

               <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                     <Database size={18} className="text-blue-600" /> Historial de Cambios en Valores
                  </h4>
                  {viaticos.length > 0 ? (
                     <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                              <tr>
                                 <th className="px-4 py-3">Registro</th>
                                 <th className="px-4 py-3">Tramo Grado</th>
                                 <th className="px-4 py-3">Vigencia</th>
                                 <th className="px-4 py-3 text-right">Monto (100%)</th>
                                 <th className="px-4 py-3 text-right">Monto (40%)</th>
                                 <th className="px-4 py-3"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {viaticos.map(v => (
                                 <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                       {v.createdAt ? new Date(v.createdAt.seconds * 1000).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-800">{v.tramoGrado}</td>
                                    <td className="px-4 py-3 text-xs">
                                       <span className="bg-slate-100 px-2 py-1 rounded-md">{formatDate(v.fechaInicio)}</span>
                                       <span className="mx-1 text-slate-400">a</span>
                                       <span className={`px-2 py-1 rounded-md ${!v.fechaTermino ? 'bg-green-50 text-green-700 font-bold' : 'bg-slate-100'}`}>
                                          {v.fechaTermino ? formatDate(v.fechaTermino) : 'Actualidad'}
                                       </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-medium">${v.valor100.toLocaleString('es-CL')}</td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-600">${v.valor40.toLocaleString('es-CL')}</td>
                                    <td className="px-4 py-3 text-right">
                                       <button onClick={() => handleDeleteViatico(v.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar registro">
                                          <Trash2 size={16} />
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  ) : (
                     <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                        <DollarSign size={32} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-500 font-medium text-sm">No existen tramos de viáticos configurados aún o no hay historial.</p>
                     </div>
                  )}
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Settings;
