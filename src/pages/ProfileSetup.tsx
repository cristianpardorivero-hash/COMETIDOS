import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Servicio } from '../types';
import { Hospital, User, Shield, CreditCard, Save } from 'lucide-react';
import { motion } from 'motion/react';

const ProfileSetup: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: user?.displayName || '',
    rut: '',
    email: user?.email || '',
    servicioId: '',
    cargo: '',
    grado: '',
    ley: '',
    planta: '',
    genero: '',
  });

  useEffect(() => {
    const fetchServicios = async () => {
      const q = query(collection(db, 'servicios'), where('activo', '==', true));
      const querySnapshot = await getDocs(q);
      const servs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Servicio));
      setServicios(servs);
      
      // If no servicios exist, maybe add some defaults for first time
      if (servs.length === 0) {
        // Admin would normally set these up
      }
    };
    fetchServicios();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const selectedServicio = servicios.find(s => s.id === form.servicioId);
      const fallbackNames: Record<string, string> = {
        'direcc': 'Dirección',
        'personal': 'Unidad de Personal',
        'finanzas': 'Unidad de Finanzas',
        'urgencias': 'Urgencias'
      };
      
      const profileData: UserProfile = {
        uid: user.uid,
        nombre: form.nombre,
        rut: form.rut,
        email: form.email,
        servicioId: form.servicioId,
        servicioNombre: selectedServicio?.nombre || fallbackNames[form.servicioId] || 'General',
        cargo: form.cargo,
        grado: form.grado,
        ley: form.ley,
        planta: form.planta,
        genero: form.genero,
        roles: ['Funcionario'], // Default
        activo: true,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', user.uid), profileData);
      await refreshProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error al guardar el perfil. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
      >
        <div className="bg-blue-600 p-6 text-white">
          <div className="flex items-center gap-3">
             <div className="bg-white/20 p-2 rounded-lg">
                <Shield size={24} />
             </div>
             <div>
                <h2 className="text-xl font-bold">Configuración de Perfil</h2>
                <p className="text-blue-100 text-xs">Complete sus datos para comenzar</p>
             </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  value={form.nombre}
                  onChange={e => setForm({...form, nombre: e.target.value})}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Juan Pérez"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">RUT</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  value={form.rut}
                  onChange={e => setForm({...form, rut: e.target.value})}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="12.345.678-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Servicio o Unidad</label>
              <div className="relative">
                <Hospital className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select 
                  value={form.servicioId}
                  onChange={e => setForm({...form, servicioId: e.target.value})}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none appearance-none"
                >
                  <option value="">Seleccione un servicio...</option>
                  {servicios.length > 0 ? (
                    servicios.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))
                  ) : (
                    // Fallback options for demo
                    <>
                      <option value="direcc">Dirección</option>
                      <option value="personal">Unidad de Personal</option>
                      <option value="finanzas">Unidad de Finanzas</option>
                      <option value="urgencias">Urgencias</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Cargo</label>
              <input 
                type="text" 
                value={form.cargo}
                onChange={e => setForm({...form, cargo: e.target.value})}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                placeholder="Enfermero(a), Médico, Auxiliar..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Grado</label>
                <input 
                  type="text" 
                  value={form.grado}
                  onChange={e => setForm({...form, grado: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Ej: 15"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Género</label>
                <select 
                  value={form.genero}
                  onChange={e => setForm({...form, genero: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none appearance-none"
                >
                  <option value="">Seleccione...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                  <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ley</label>
                <input 
                  type="text" 
                  value={form.ley}
                  onChange={e => setForm({...form, ley: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Ej: 18.834"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Planta</label>
                <select 
                  value={form.planta}
                  onChange={e => setForm({...form, planta: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none appearance-none"
                >
                  <option value="">Seleccione...</option>
                  <option value="Directivo">Directivo</option>
                  <option value="Profesional">Profesional</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Administrativo">Administrativo</option>
                  <option value="Auxiliar">Auxiliar</option>
                  <option value="Contrata">Contrata</option>
                  <option value="Honorarios">Honorarios</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={20} />
                <span>Guardar y Continuar</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default ProfileSetup;
