import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { X, Save, AlertCircle, Calendar, Briefcase } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { UserProfile, Reemplazo } from '../types';
import { calculateBusinessDaysChile } from '../lib/dateUtilsChile';

interface ReemplazoFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReemplazoForm({ onClose, onSuccess }: ReemplazoFormProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [funcionarios, setFuncionarios] = useState<UserProfile[]>([]);
  const [selectedFuncionarioInfo, setSelectedFuncionarioInfo] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState({
    funcionarioReemplazoUid: '',
    motivo: 'Feriado legal',
    observacionMotivo: '',
    nombreReemplazante: '',
    rutReemplazante: '',
    profesionReemplazante: '',
    fechaInicio: '',
    fechaTermino: '',
  });

  const [signatureType, setSignatureType] = useState<'sello' | 'tactil'>('sello');
  const sigCanvas = React.useRef<any>(null);

  useEffect(() => {
    // Fetch all users from the same servicio
    const fetchFuncionarios = async () => {
      if (!profile?.servicioId) return;
      try {
        const q = query(
          collection(db, 'users'), 
          where('servicioId', '==', profile.servicioId),
          where('activo', '==', true)
        );
        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(doc => doc.data() as UserProfile);
        setFuncionarios(users);
      } catch (err) {
        console.error(err);
      }
    };
    fetchFuncionarios();
  }, [profile]);

  useEffect(() => {
    if (formData.funcionarioReemplazoUid) {
      const f = funcionarios.find(u => u.uid === formData.funcionarioReemplazoUid);
      setSelectedFuncionarioInfo(f || null);
    } else {
      setSelectedFuncionarioInfo(null);
    }
  }, [formData.funcionarioReemplazoUid, funcionarios]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleClearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!formData.funcionarioReemplazoUid) {
      setError('Debe seleccionar el funcionario a reemplazar.');
      return;
    }

    if (!formData.nombreReemplazante.trim()) {
      setError('Debe ingresar el nombre del reemplazante.');
      return;
    }

    if (!formData.rutReemplazante.trim()) {
      setError('Debe ingresar el RUT del reemplazante.');
      return;
    }

    const cleanRut = formData.rutReemplazante.replace(/[^0-9kK-]/g, '');
    const rutRegex = /^[0-9]+-[0-9kK]{1}$/;
    if (!rutRegex.test(cleanRut)) {
      setError('El RUT del reemplazante no tiene un formato válido (Ej: 12345678-9).');
      return;
    }

    if (formData.motivo === 'Otro' && !formData.observacionMotivo.trim()) {
      setError('Debe especificar el motivo del reemplazo.');
      return;
    }

    if (!formData.fechaInicio || !formData.fechaTermino) {
      setError('Debe ingresar las fechas de inicio y término del reemplazo.');
      return;
    }

    if (new Date(formData.fechaInicio) > new Date(formData.fechaTermino)) {
      setError('La fecha de inicio no puede ser mayor a la fecha de término.');
      return;
    }

    if (signatureType === 'tactil' && sigCanvas.current?.isEmpty()) {
      setError('La firma de la jefatura es obligatoria.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const docRef = doc(collection(db, 'reemplazos'));
      const id = docRef.id;
      
      let firmaData = '';
      let selloDigitalJefatura = '';

      if (signatureType === 'tactil') {
        firmaData = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
      } else {
        // Generar un "Sello Institucional" digital
        // Creamos un canvas temporal para generar una imagen de sello
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#1e40af'; // Blue-800
          ctx.lineWidth = 4;
          ctx.strokeRect(10, 10, 380, 180);
          
          ctx.fillStyle = '#1e40af';
          ctx.font = 'bold 20px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SELLO INSTITUCIONAL', 200, 50);
          
          ctx.font = 'bold 16px Inter, sans-serif';
          ctx.fillText('HOSPITAL CUREPTO', 200, 85);
          
          ctx.font = 'medium 14px Inter, sans-serif';
          ctx.fillText(profile.nombre.toUpperCase(), 200, 120);
          ctx.fillText(profile.cargo.toUpperCase(), 200, 145);
          
          ctx.font = 'italic 12px Inter, sans-serif';
          ctx.fillText(new Date().toLocaleString(), 200, 175);
          
          firmaData = canvas.toDataURL('image/png');
          selloDigitalJefatura = `INST-SEAL-${profile.uid}-${Date.now()}`;
        }
      }
      
      const newReemplazo: Reemplazo = {
        id,
        funcionarioReemplazoUid: formData.funcionarioReemplazoUid,
        nombreFuncionario: selectedFuncionarioInfo?.nombre || '',
        rutFuncionario: selectedFuncionarioInfo?.rut || '',
        cargoFuncionario: selectedFuncionarioInfo?.cargo || '',
        gradoFuncionario: selectedFuncionarioInfo?.grado || '',
        leyFuncionario: selectedFuncionarioInfo?.ley || '',
        plantaFuncionario: selectedFuncionarioInfo?.planta || '',

        jefaturaUid: profile.uid,
        nombreJefatura: profile.nombre,
        servicioId: profile.servicioId,
        servicioNombre: profile.servicioNombre,

        motivo: formData.motivo as 'Feriado legal' | 'Otro',
        observacionMotivo: formData.observacionMotivo,

        nombreReemplazante: formData.nombreReemplazante,
        rutReemplazante: formData.rutReemplazante,
        profesionReemplazante: formData.profesionReemplazante,

        fechaInicio: formData.fechaInicio,
        fechaTermino: formData.fechaTermino,

        estado: 'Pendiente revisión Dirección',

        firmaJefatura: firmaData,
        selloDigitalJefatura: selloDigitalJefatura,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'reemplazos', id), newReemplazo);
      onSuccess();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'reemplazos');
      setError('Error al crear la solicitud');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Nueva Solicitud de Reemplazo</h2>
            <p className="text-sm font-medium text-slate-500">Comisiones de Servicio / {profile?.servicioNombre}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          <form id="reemplazo-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
                <AlertCircle size={20} />
                <p className="text-sm font-bold">{error}</p>
              </div>
            )}

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Datos del Funcionario a Reemplazar</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Seleccione Funcionario del Servicio *</label>
                <select 
                  name="funcionarioReemplazoUid" 
                  value={formData.funcionarioReemplazoUid} 
                  onChange={handleChange} 
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                >
                  <option value="">-- Seleccione --</option>
                  {funcionarios.map(f => (
                    <option key={f.uid} value={f.uid}>{f.nombre} - {f.rut}</option>
                  ))}
                </select>
              </div>

              {selectedFuncionarioInfo && (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                   <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Cargo / Profesión</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedFuncionarioInfo.cargo}</p>
                   </div>
                   <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Planta / Ley</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedFuncionarioInfo.planta} / {selectedFuncionarioInfo.ley}</p>
                   </div>
                   <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Grado</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedFuncionarioInfo.grado}</p>
                   </div>
                </div>
              )}
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Motivo del Reemplazo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Motivo *</label>
                  <select 
                    name="motivo" 
                    value={formData.motivo} 
                    onChange={handleChange} 
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  >
                    <option value="Feriado legal">Feriado legal</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                {formData.motivo === 'Otro' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Especifique el Motivo *</label>
                    <input 
                      type="text" 
                      name="observacionMotivo" 
                      value={formData.observacionMotivo} 
                      onChange={handleChange}
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Datos del Reemplazante</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Nombre Completo *</label>
                  <input 
                    type="text" 
                    name="nombreReemplazante" 
                    value={formData.nombreReemplazante} 
                    onChange={handleChange} 
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">RUT *</label>
                  <input 
                    type="text" 
                    name="rutReemplazante" 
                    value={formData.rutReemplazante} 
                    onChange={handleChange} 
                    required
                    placeholder="12.345.678-9"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Profesión / Función *</label>
                  <input 
                    type="text" 
                    name="profesionReemplazante" 
                    value={formData.profesionReemplazante} 
                    onChange={handleChange} 
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2">
                <Calendar size={16} className="text-blue-500"/>
                Período de Reemplazo
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Desde Fecha *</label>
                  <input 
                    type="date" 
                    name="fechaInicio" 
                    value={formData.fechaInicio} 
                    onChange={handleChange} 
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Hasta Fecha *</label>
                  <input 
                    type="date" 
                    name="fechaTermino" 
                    value={formData.fechaTermino} 
                    onChange={handleChange} 
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  />
                </div>
              </div>
              
              {formData.fechaInicio && formData.fechaTermino && (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Briefcase size={16} />
                    <span className="text-xs font-bold uppercase tracking-wide">Total Días Laborales (Chile)</span>
                  </div>
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-black shadow-sm shadow-blue-200">
                    {calculateBusinessDaysChile(formData.fechaInicio, formData.fechaTermino)} Días
                  </span>
                </div>
              )}
            </div>

            {/* Signature Area */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Validación de Jefatura *</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => setSignatureType('sello')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${signatureType === 'sello' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Sello Institucional
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSignatureType('tactil')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${signatureType === 'tactil' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Firma Táctil
                  </button>
                </div>
              </div>

              {signatureType === 'sello' ? (
                <div className="border-2 border-dashed border-blue-200 rounded-xl p-8 bg-blue-50/30 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <Save size={32} />
                  </div>
                  <div>
                    <p className="font-bold text-blue-800">Sello Institucional Digital</p>
                    <p className="text-xs text-blue-600 font-medium">Se generará un sello con su nombre, cargo y marca de tiempo institucional.</p>
                  </div>
                  <div className="bg-white border border-blue-200 px-4 py-2 rounded-lg text-[10px] font-mono text-blue-800">
                    AUTHENTICITY_VERIFIED_BY_HOSPTIAL_CUREPTO_{profile?.uid.slice(0,8)}
                  </div>
                </div>
              ) : (
                <>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                    <SignatureCanvas 
                      ref={sigCanvas}
                      penColor="#0f172a"
                      canvasProps={{ className: 'w-full h-40 cursor-crosshair' }} 
                    />
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={handleClearSignature} className="text-sm text-slate-500 hover:text-slate-700 font-semibold px-3 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                      Limpiar Firma
                    </button>
                  </div>
                </>
              )}
            </div>

          </form>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button 
            form="reemplazo-form"
            type="submit" 
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-200 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : (
              <>
                <Save size={18} />
                Enviar Solicitud
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
