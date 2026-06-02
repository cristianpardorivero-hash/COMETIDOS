import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Cometido } from '../types';
import { X, Send, ArrowLeft, ArrowRight, User, MapPin, Truck, PlusCircle, Paperclip, FileText, PenTool, Trash2, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  cometidoToEdit?: Cometido;
}

const CometidoForm: React.FC<Props> = ({ onClose, onSuccess, cometidoToEdit }) => {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [useSelloDigital, setUseSelloDigital] = useState(true);
  
  const isOwner = profile?.uid === cometidoToEdit?.funcionarioUid;
  const isJefatura = profile?.roles?.includes('Jefatura de Servicio');
  const isDirector = profile?.roles?.includes('Director');
  const isPersonal = profile?.roles?.includes('Personal');
  const isFinanzas = profile?.roles?.includes('Finanzas');
  const isAdmin = profile?.roles?.includes('Administrador');

  const getNewState = () => {
    if (!cometidoToEdit) return 'Pendiente revisión jefatura';
    if (isOwner && ['Borrador', 'Devuelto por jefatura', 'Devuelto por Dirección', 'Devuelto para corrección'].includes(cometidoToEdit.estado)) {
      return 'Pendiente revisión jefatura';
    }
    return cometidoToEdit.estado;
  };

  const isFieldDisabled = (fieldName: string) => {
    if (!cometidoToEdit) return false;

    const estado = cometidoToEdit.estado;

    if (['Rechazado', 'Rechazado por jefatura', 'Rechazado por Dirección', 'Rechazado por Personal', 'Rechazado por Finanzas', 'Pagado', 'Finalizado', 'No corresponde pago'].includes(estado)) {
      return true;
    }

    if (fieldName === 'posibleViatico') {
        if (estado === 'Pendiente revisión jefatura' || estado === 'Devuelto por jefatura' || estado === 'Borrador') {
            return !(isOwner || isJefatura || isAdmin);
        }
        if (['Pendiente revisión Dirección', 'Aprobado por jefatura', 'Devuelto por Dirección', 'En revisión por Personal', 'En revisión por Finanzas', 'Autorizado por Dirección'].includes(estado)) {
            return !(isJefatura || isDirector || isPersonal || isFinanzas || isAdmin);
        }
        return false;
    }

    if (fieldName === 'resolucionAdministrativa') {
        return !(isPersonal || isAdmin);
    }

    // States where owner/initiator can edit
    const isReturnedState = ['Borrador', 'Devuelto por jefatura', 'Devuelto por Dirección', 'Devuelto para corrección'].includes(estado);
    
    if (estado === 'Pendiente revisión jefatura') {
        return !(isOwner || isJefatura || isAdmin);
    }

    if (isReturnedState) {
        return !(isOwner || isJefatura || isDirector || isPersonal || isAdmin);
    }

    if (estado === 'Pendiente revisión Dirección') {
        return !(isDirector || isAdmin);
    }

    if (estado === 'Autorizado por Dirección' || estado === 'En revisión por Personal') {
        return !(isPersonal || isAdmin);
    }

    if (estado === 'En revisión por Finanzas') {
        return !(isFinanzas || isAdmin);
    }

    return true; 
  };

  const [form, setForm] = useState<Partial<Cometido>>(cometidoToEdit ? {
    ...cometidoToEdit,
    estado: getNewState(),
  } : {
    tipoCometido: 'Reunión',
    motivo: '',
    destino: '',
    ciudad: '',
    region: 'Maule',
    fechaInicio: new Date().toISOString().split('T')[0],
    horaInicio: '08:00',
    fechaTermino: new Date().toISOString().split('T')[0],
    horaTermino: '18:00',
    medioTransporte: 'Vehículo institucional',
    requiereTraslado: false,
    fueraDeCurepto: true,
    aplicaDistancia: true,
    pernoctado: false,
    posibleViatico: 'Por evaluar',
    observacionesFuncionario: '',
    documentosAdjuntos: [],
    resolucionAdministrativa: '',
    estado: 'Pendiente revisión jefatura',
  });

  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, size: string}[]>([]);

  const CIUDADES_MAULE = [
    "Talca", "Curicó", "Linares", "Cauquenes", "Constitución", "San Javier", 
    "Molina", "Parral", "San Clemente", "Teno", "Pelarco", "Río Claro", 
    "Pencahue", "Maule", "San Rafael", "Empedrado", "Curepto", "Licantén", 
    "Vichuquén", "Hualañé", "Romeral", "Sagrada Familia", "Rauco", "Longaví", 
    "Yerbas Buenas", "Colbún", "Retiro", "Pelluhue", "Chanco", "Santiago", "Otra"
  ];

  const DESTINOS_PREDEFINIDOS = [
    "Hospital Regional de Talca", "Hospital de Curicó", "Hospital de Linares", 
    "Hospital de Cauquenes", "Hospital de Constitución", "Hospital de Parral", 
    "Hospital de San Javier", "Hospital de Molina", "Hospital de Hualañé", 
    "Hospital de Licantén", "Hospital de Curepto", "Hospital de Teno", 
    "Hospital de Chanco", "Hospital de San Clemente", "Servicio de Salud Maule", 
    "Seremi de Salud Maule", "Universidad de Talca", "Universidad Católica del Maule", 
    "Universidad Autónoma (Talca)", "Ministerio de Salud", "Subsecretaría de Redes Asistenciales"
  ];

  const DESTINO_CIUDAD_MAP: Record<string, string> = {
    "Hospital Regional de Talca": "Talca",
    "Hospital de Curicó": "Curicó",
    "Hospital de Linares": "Linares",
    "Hospital de Cauquenes": "Cauquenes",
    "Hospital de Constitución": "Constitución",
    "Hospital de Parral": "Parral",
    "Hospital de San Javier": "San Javier",
    "Hospital de Molina": "Molina",
    "Hospital de Hualañé": "Hualañé",
    "Hospital de Licantén": "Licantén",
    "Hospital de Curepto": "Curepto",
    "Hospital de Teno": "Teno",
    "Hospital de Chanco": "Chanco",
    "Hospital de San Clemente": "San Clemente",
    "Servicio de Salud Maule": "Talca",
    "Seremi de Salud Maule": "Talca",
    "Universidad de Talca": "Talca",
    "Universidad Católica del Maule": "Talca",
    "Universidad Autónoma (Talca)": "Talca",
    "Ministerio de Salud": "Santiago",
    "Subsecretaría de Redes Asistenciales": "Santiago"
  };

  const handleDestinoChange = (val: string) => {
    const changes: Partial<Cometido> = { destino: val };
    
    // Si el destino está en el mapa, actualizar ciudad automáticamente
    if (DESTINO_CIUDAD_MAP[val]) {
      const ciudad = DESTINO_CIUDAD_MAP[val];
      changes.ciudad = ciudad;
      
      // Aplicar lógica de "fuera de Curepto"
      if (ciudad !== 'Talca' && ciudad !== '') {
        changes.fueraDeCurepto = true;
        changes.aplicaDistancia = true;
      }
    }
    
    setForm(prev => ({ ...prev, ...changes }));
  };

  const handleCiudadChange = (val: string) => {
    const changes: Partial<Cometido> = { ciudad: val };
    
    // Si se selecciona cualquier ciudad que no sea Talca, marcar fuera de Curepto y aplica distancia
    if (val !== 'Talca' && val !== '') {
      changes.fueraDeCurepto = true;
      changes.aplicaDistancia = true;
    }
    
    setForm(prev => ({ ...prev, ...changes }));
  };

  const handleSimulateUpload = () => {
    setUploading(true);
    setTimeout(() => {
      const newFile = {
        name: `documento_respaldo_${uploadedFiles.length + 1}.pdf`,
        size: '1.2 MB'
      };
      setUploadedFiles([...uploadedFiles, newFile]);
      setForm(prev => ({
        ...prev,
        documentosAdjuntos: [...(prev.documentosAdjuntos || []), "https://firebasestorage.googleapis.com/.../mock"]
      }));
      setUploading(false);
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    // Evaluamos si el usuario actual es el dueño (o si es un nuevo cometido)
    const isCreator = !cometidoToEdit || isOwner;

    // Solo validamos la firma si estamos creando o si somos el dueño editando,
    // y además lo estamos haciendo desde el paso final (Paso 5)
    let finalSignature: string | null = null;
    let finalSello: string = '';
    
    if (isCreator) {
      const isSigEmpty = sigPad.current?.isEmpty();
      finalSignature = isSigEmpty ? null : (sigPad.current?.toDataURL('image/png') || null);
      
      if (useSelloDigital) {
        finalSello = `AUTH_GID_${profile.uid.substring(0, 12).toUpperCase()}_${new Date().getTime().toString(16).toUpperCase()}`;
      } else {
        // Validación de Firma Táctil
        if (!finalSignature && !cometidoToEdit?.firmaFuncionario) {
          alert('Por favor, firme la solicitud en el recuadro antes de enviarla, o utilice el Sello Institucional.');
          return;
        }
      }
    }

    setLoading(true);

    try {
      // Clean form for update
      const dataToSave = { ...form };
      delete dataToSave.id;
      delete dataToSave.createdAt;
      delete dataToSave.updatedAt;
      
      // Clean undefined
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key as keyof typeof dataToSave] === undefined) {
          delete dataToSave[key as keyof typeof dataToSave];
        }
      });

      if (cometidoToEdit) {
        const docRef = doc(db, 'cometidos', cometidoToEdit.id);
        const updateData: any = {
          ...dataToSave,
          estado: getNewState(),
          updatedAt: serverTimestamp(),
        };

        // Si soy el dueño/creador, se me permite actualizar mi firma
        if (isCreator) {
          updateData.firmaFuncionario = useSelloDigital ? '' : (finalSignature || cometidoToEdit.firmaFuncionario || '');
          updateData.selloDigitalFuncionario = useSelloDigital ? finalSello : '';
        }

        await updateDoc(docRef, updateData);

        // Log history
        const isEditingApproveState = cometidoToEdit.estado === updateData.estado;
        await addDoc(collection(db, 'historial_cometidos'), {
          cometidoId: cometidoToEdit.id,
          fecha: serverTimestamp(),
          usuarioUid: profile.uid,
          usuarioNombre: profile.nombre,
          rol: profile.roles?.join(', ') || 'Funcionario',
          accion: isEditingApproveState ? 'Actualización de solicitud' : 'Resubida de solicitud',
          estadoAnterior: cometidoToEdit.estado,
          estadoNuevo: updateData.estado,
          observacion: isEditingApproveState ? 'Solicitud editada durante el flujo' : 'Solicitud corregida y re-enviada por el funcionario',
        });
      } else {
        const newCometidoData = {
          ...dataToSave,
          funcionarioUid: profile.uid,
          nombreFuncionario: profile.nombre || '',
          rut: profile.rut || '',
          email: profile.email || '',
          servicioId: profile.servicioId || 'medicina',
          servicioNombre: profile.servicioNombre || 'Medicina',
          cargo: profile.cargo || '',
          grado: profile.grado || '',
          ley: profile.ley || '',
          planta: profile.planta || '',
          genero: profile.genero || '',
          jefaturaUid: profile.jefaturaId || '',
          nombreJefatura: profile.jefaturaNombre || '',
          firmaFuncionario: useSelloDigital ? '' : (finalSignature || ''),
          selloDigitalFuncionario: useSelloDigital ? finalSello : '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        console.log("Submitting cometido", newCometidoData);
        const docRef = await addDoc(collection(db, 'cometidos'), newCometidoData);
        
        // Log history
        await addDoc(collection(db, 'historial_cometidos'), {
          cometidoId: docRef.id,
          fecha: serverTimestamp(),
          usuarioUid: profile.uid,
          usuarioNombre: profile.nombre,
          rol: profile.roles?.join(', ') || 'Funcionario',
          accion: 'Creación de solicitud',
          estadoAnterior: 'N/A',
          estadoNuevo: 'Pendiente revisión jefatura',
          observacion: 'Solicitud ingresada por el funcionario',
        });
      }
      
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Solicitud guardada correctamente' }));
      onSuccess();
    } catch (error) {
      console.error('Error saving cometido:', error);
      try {
        handleFirestoreError(error, cometidoToEdit ? OperationType.UPDATE : OperationType.CREATE, cometidoToEdit ? `cometidos/${cometidoToEdit.id}` : 'cometidos');
      } catch (err) {
        let msg = 'Error desconocido';
        if (err instanceof Error) {
          try {
            const parsed = JSON.parse(err.message);
            msg = parsed.error;
          } catch {
            msg = err.message;
          }
        }
        alert(`Error al guardar: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: 'Información Básica', icon: User },
    { title: 'Destino y Fechas', icon: MapPin },
    { title: 'Transporte y Viáticos', icon: Truck },
    { title: 'Documentación', icon: Paperclip },
    { title: 'Firma Digital', icon: PenTool },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <PlusCircle />
            <h2 className="text-xl font-bold">{cometidoToEdit ? 'Editar Solicitud de Cometido' : 'Nueva Solicitud de Cometido'}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X />
          </button>
        </div>

        {/* Stepper */}
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 hidden md:flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider ${
                step === i + 1 ? 'text-blue-600' : 'text-slate-400'
              }`}>
                {s.title}
              </span>
              {i < steps.length - 1 && <div className="w-12 h-px bg-slate-200 mx-2" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
          {step === 1 && (
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Cometido</label>
                  <select 
                    value={form.tipoCometido} 
                    onChange={e => setForm({...form, tipoCometido: e.target.value as any})}
                    disabled={isFieldDisabled('tipoCometido')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium disabled:opacity-50"
                  >
                    <option>Reunión</option>
                    <option>Traslado</option>
                    <option>Capacitación</option>
                    <option>Comisión de servicio</option>
                    <option>Otro</option>
                  </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Motivo Principal</label>
                    <input 
                      type="text" 
                      value={form.motivo} 
                      onChange={e => setForm({...form, motivo: e.target.value})}
                      required
                      disabled={isFieldDisabled('motivo')}
                      placeholder="Ej: Reunión técnica de red asistencial"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium disabled:opacity-50"
                    />
                </div>
                {isPersonal || isAdmin || form.resolucionAdministrativa ? (
                  <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-700 mb-2">Responsable / Resolución Administrativa (Personal)</label>
                      <input 
                        type="text" 
                        value={form.resolucionAdministrativa || ''} 
                        onChange={e => setForm({...form, resolucionAdministrativa: e.target.value})}
                        disabled={isFieldDisabled('resolucionAdministrativa')}
                        placeholder="Solo Personal: Ingrese N° de Resolución"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium disabled:opacity-50"
                      />
                  </div>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Observaciones Preliminares</label>
                <textarea 
                  rows={4}
                  value={form.observacionesFuncionario} 
                  onChange={e => setForm({...form, observacionesFuncionario: e.target.value})}
                  disabled={isFieldDisabled('observacionesFuncionario')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium resize-none disabled:opacity-50"
                  placeholder="Detalles adicionales del cometido..."
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Institución o Lugar de Destino</label>
                    <input 
                      list="destinos-list"
                      type="text" 
                      value={form.destino} 
                      onChange={e => handleDestinoChange(e.target.value)}
                      required
                      disabled={isFieldDisabled('destino')}
                      placeholder="Seleccione o escriba el lugar de destino"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium disabled:opacity-50"
                    />
                    <datalist id="destinos-list">
                      {DESTINOS_PREDEFINIDOS.map(d => <option key={d} value={d} />)}
                    </datalist>
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Ciudad</label>
                    <select 
                      value={form.ciudad} 
                      onChange={e => handleCiudadChange(e.target.value)}
                      required
                      disabled={isFieldDisabled('ciudad')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium disabled:opacity-50"
                    >
                      <option value="">Seleccione Ciudad</option>
                      {CIUDADES_MAULE.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                 </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="md:col-span-1 lg:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Fecha Inicio</label>
                    <input type="date" disabled={isFieldDisabled('fechaInicio')} value={form.fechaInicio} onChange={e => setForm({...form, fechaInicio: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg p-2 disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Hora Inicio</label>
                    <input type="time" disabled={isFieldDisabled('horaInicio')} value={form.horaInicio} onChange={e => setForm({...form, horaInicio: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg p-2 disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Fecha Término</label>
                    <input type="date" disabled={isFieldDisabled('fechaTermino')} value={form.fechaTermino} onChange={e => setForm({...form, fechaTermino: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg p-2 disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Hora Término</label>
                    <input type="time" disabled={isFieldDisabled('horaTermino')} value={form.horaTermino} onChange={e => setForm({...form, horaTermino: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg p-2 disabled:opacity-50" />
                  </div>
               </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Medio de Transporte</label>
                    {['Vehículo institucional', 'Vehículo particular', 'Bus', 'Otro'].map(opt => (
                      <label key={opt} className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                        <input 
                          type="radio" 
                          name="transporte" 
                          checked={form.medioTransporte === opt} 
                          onChange={() => setForm({...form, medioTransporte: opt as any})} 
                          disabled={isFieldDisabled('medioTransporte')}
                        />
                        <span className="text-sm font-medium text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div>
                        <p className="font-bold text-blue-900 text-sm">Requiere traslado institucional</p>
                        <p className="text-xs text-blue-600">Coordinación directa con movilización</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={form.requiereTraslado} 
                        onChange={e => setForm({...form, requiereTraslado: e.target.checked})}
                        disabled={isFieldDisabled('requiereTraslado')}
                        className="w-5 h-5 accent-blue-600 disabled:opacity-50" 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">¿Es fuera de Curepto?</p>
                        <p className="text-xs text-slate-500 mt-0.5">Define viático y traslados</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={form.fueraDeCurepto} 
                        onChange={e => setForm({...form, fueraDeCurepto: e.target.checked})}
                        disabled={isFieldDisabled('fueraDeCurepto')}
                        className="w-5 h-5 accent-blue-600 disabled:opacity-50" 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                       <div>
                         <p className="font-bold text-indigo-900 text-sm">Aplica cálculo de distancia</p>
                         <p className="text-xs text-indigo-600 mt-0.5">Cálculo automático de kilometraje</p>
                       </div>
                       <input 
                         type="checkbox" 
                         checked={form.aplicaDistancia} 
                         onChange={e => setForm({...form, aplicaDistancia: e.target.checked})}
                         disabled={isFieldDisabled('aplicaDistancia')}
                         className="w-5 h-5 accent-indigo-600 disabled:opacity-50" 
                       />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
                       <div>
                         <p className="font-bold text-amber-900 text-sm">¿Pernoctado?</p>
                         <p className="text-xs text-amber-600 mt-0.5">Sí: 100% Viático | No: Sin Pernoctar</p>
                       </div>
                       <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setForm({...form, pernoctado: false})}
                            disabled={isFieldDisabled('pernoctado')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${!form.pernoctado ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-50'}`}
                          >
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm({...form, pernoctado: true})}
                            disabled={isFieldDisabled('pernoctado')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${form.pernoctado ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-50'}`}
                          >
                            Sí
                          </button>
                       </div>
                    </div>

                    <div>
                       <label className="block text-sm font-bold text-slate-700 mb-2">Posible derecho a viático</label>
                       <select 
                          value={form.posibleViatico} 
                          onChange={e => setForm({...form, posibleViatico: e.target.value as any})}
                          disabled={isFieldDisabled('posibleViatico')}
                          className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none transition-all font-medium ${
                            isFieldDisabled('posibleViatico') 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'focus:ring-2 focus:ring-blue-500'
                          }`}
                       >
                          <option>Sí</option>
                          <option>No</option>
                          <option>Por evaluar</option>
                       </select>
                    </div>
                  </div>
               </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
               <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 transition-all hover:bg-slate-100/50">
                  <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                     <Paperclip size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 text-center">Documentos de Respaldo</h3>
                  <p className="text-slate-500 max-w-xs mx-auto mt-2 text-sm text-center">Adjunte invitaciones, programas o convocatorias.</p>
                  
                  <div className="mt-8 space-y-3">
                     {uploadedFiles.map((file, i) => (
                       <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-3">
                             <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                <FileText size={18} />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-slate-700">{file.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{file.size}</p>
                             </div>
                          </div>
                          {!isFieldDisabled('documentosAdjuntos') && (
                            <button onClick={() => setUploadedFiles(files => files.filter((_, idx) => idx !== i))} className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors">
                               <X size={16} />
                            </button>
                          )}
                       </div>
                     ))}

                     {uploading && (
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center gap-4">
                           <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                           <span className="text-sm font-bold text-blue-700">Subiendo archivo...</span>
                        </div>
                     )}

                     {!isFieldDisabled('documentosAdjuntos') && (
                       <button 
                        type="button" 
                        onClick={handleSimulateUpload}
                        disabled={uploading}
                        className="w-full mt-4 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                       >
                          <PlusCircle size={18} />
                          Seleccionar Archivo
                       </button>
                     )}
                  </div>
               </div>
               
               <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-left">
                  <h4 className="font-bold text-blue-900 mb-2">Resumen de Envío</h4>
                  <p className="text-xs text-blue-700 leading-relaxed font-medium">
                    Al enviar esta solicitud, se notificará a su **jefatura directa** ({profile?.jefaturaNombre || profile?.servicioNombre}) para revisión inicial. Una vez aprobada, el proceso continuará hacia Dirección, Personal y Finanzas. Podrá realizar seguimiento en tiempo real desde su dashboard corporativo.
                  </p>
               </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6 text-left">
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
                {!cometidoToEdit || isOwner ? (
                  <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Método de Firma e Identidad</h3>
                        <p className="text-sm text-slate-500">Elija como desea validar formalmente su solicitud.</p>
                      </div>
                      <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setUseSelloDigital(false)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!useSelloDigital ? 'bg-blue-600 text-white shadow-md' : 'text-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                          Firma Táctil
                        </button>
                        <button
                          type="button"
                          onClick={() => setUseSelloDigital(true)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${useSelloDigital ? 'bg-blue-600 text-white shadow-md' : 'text-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                          Sello Institucional
                        </button>
                      </div>
                    </div>

                    {!useSelloDigital ? (
                      <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-inner flex flex-col items-center">
                        <SignatureCanvas 
                          ref={sigPad}
                          penColor="#0f172a"
                          canvasProps={{
                            width: 600, 
                            height: 200, 
                            className: 'signature-canvas cursor-crosshair w-full' 
                          }}
                          onEnd={() => setSignatureData(sigPad.current?.toDataURL() || null)}
                        />
                        <div className="w-full bg-slate-50 p-2 border-t border-slate-100 flex justify-center">
                           <button 
                            type="button" 
                            onClick={() => sigPad.current?.clear()}
                            className="text-[10px] font-bold text-red-500 uppercase flex items-center gap-1 px-3 py-1 hover:bg-red-50 rounded"
                           >
                             <Trash2 size={12} />
                             Limpiar Firma
                           </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border-2 border-blue-100 rounded-2xl p-10 flex flex-col items-center text-center shadow-sm">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 border-2 border-blue-100">
                          <Shield size={40} className="text-blue-600 animate-pulse" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-800">Sello Digital Institucional Activo</h4>
                        <p className="text-xs text-slate-500 max-w-sm mt-2">
                          Se generará un código de verificación único vinculado a su identidad corporativa. 
                          Este sello tiene plena validez interna en el Hospital de Curepto.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-center text-center">
                    <div>
                      <Shield size={32} className="text-blue-500 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-blue-900">Edición en progreso</h3>
                      <p className="text-sm text-blue-700 mt-2">
                        Está editando este cometido. Su identidad quedará registrada en el historial de acciones y no necesita modificar la firma del funcionario.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2 text-green-700">
                      <User size={18} />
                      <span className="font-bold text-sm">Autenticado como</span>
                    </div>
                    <p className="text-xs font-medium text-green-600">{profile?.nombre}</p>
                    <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider mt-1">RUT: {profile?.rut}</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2 text-blue-700">
                      <Shield size={18} />
                      <span className="font-bold text-sm">Sello Digital</span>
                    </div>
                    <p className="text-[10px] font-mono text-blue-600 break-all leading-tight">
                      AUTH_GID_{profile?.uid.substring(0, 12).toUpperCase()}_{new Date().getTime().toString(16).toUpperCase()}
                    </p>
                    <p className="text-[10px] text-blue-400 mt-1 italic font-medium">Validación via Google Identity</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center">
                    <div className="bg-white p-1.5 rounded-lg shadow-sm mb-2">
                       <QRCodeSVG 
                         value={`HOSPITAL_CUREPTO_VERIFY_REQUESTER: \nNAME: ${profile?.nombre} \nRUT: ${profile?.rut} \nDATE: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`}
                         size={64}
                         level="M"
                       />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Validación QR</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 italic">
                <div className="text-amber-500 flex-shrink-0 mt-0.5">
                  <Shield size={16} />
                </div>
                <p className="text-xs text-amber-700 leading-relaxed font-medium text-pretty">
                  Declaración Jurada: Al firmar digitalmente, declaro que la información proporcionada es fidedigna y que el cometido solicitado se ajusta a las necesidades institucionales vigentes.
                </p>
              </div>
            </motion.div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl disabled:opacity-0 transition-all"
          >
            <ArrowLeft size={20} />
            Anterior
          </button>
          
          <div className="flex items-center gap-3">
             <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-slate-500 font-bold hover:text-slate-700 transition-colors"
             >
                Cancelar
             </button>
             {step < 5 ? (
               <button
                 type="button"
                 onClick={() => setStep(s => s + 1)}
                 className="flex items-center gap-2 bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all"
               >
                 Siguiente
                 <ArrowRight size={20} />
               </button>
             ) : (
               <button
                 type="submit"
                 onClick={handleSubmit}
                 disabled={loading}
                 className="flex items-center gap-2 bg-blue-600 text-white px-10 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
               >
                 {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                   <>
                     <Send size={20} />
                     {cometidoToEdit ? 'Guardar Cambios' : 'Enviar Solicitud'}
                   </>
                 )}
               </button>
             )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CometidoForm;
