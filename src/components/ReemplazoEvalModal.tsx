import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Reemplazo, UserProfile } from '../types';
import { X, Check, FileEdit, Calendar, XCircle, AlertCircle, Briefcase, Save, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/dateUtils';
import { calculateBusinessDaysChile } from '../lib/dateUtilsChile';
import SignatureCanvas from 'react-signature-canvas';
import PDFPreviewModal from './PDFPreviewModal';

interface ReemplazoEvalModalProps {
  reemplazo: Reemplazo;
  onClose: () => void;
  onSuccess: () => void;
  readOnly?: boolean;
}

export default function ReemplazoEvalModal({ reemplazo, onClose, onSuccess, readOnly = false }: ReemplazoEvalModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fechaInicio, setFechaInicio] = useState(reemplazo.fechaInicio);
  const [fechaTermino, setFechaTermino] = useState(reemplazo.fechaTermino);
  const [observacionDirector, setObservacionDirector] = useState(reemplazo.observacionDirector || '');
  const [signatureType, setSignatureType] = useState<'sello' | 'tactil'>('sello');
  const [showPdf, setShowPdf] = useState(false);
  
  const sigCanvas = useRef<any>(null);

  const handleDecision = async (decision: 'Autorizado' | 'Rechazado') => {
    if (readOnly) return;
    if (!profile) return;
    
    if (decision === 'Autorizado' && signatureType === 'tactil' && sigCanvas.current?.isEmpty()) {
       setError('Debe firmar para autorizar la solicitud.');
       return;
    }

    setLoading(true);
    setError('');

    try {
      let firmaData = '';
      let selloDigitalDirector = '';

      if (decision === 'Autorizado') {
        if (signatureType === 'tactil') {
          firmaData = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
        } else {
          // Generar un "Sello Institucional" digital para el Director
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
            ctx.fillText('SELLO DIRECCIÓN', 200, 50);
            
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.fillText('HOSPITAL CUREPTO', 200, 85);
            
            ctx.font = 'medium 14px Inter, sans-serif';
            ctx.fillText(profile.nombre.toUpperCase(), 200, 120);
            ctx.fillText('DIRECTOR(A) HOSPITAL CUREPTO', 200, 145);
            
            ctx.font = 'italic 12px Inter, sans-serif';
            ctx.fillText(new Date().toLocaleString(), 200, 175);
            
            firmaData = canvas.toDataURL('image/png');
            selloDigitalDirector = `DIR-SEAL-${profile.uid}-${Date.now()}`;
          }
        }
      }

      const updateData: any = {
        estado: decision === 'Autorizado' ? 'Aprobado por Dirección' : 'Rechazado por Dirección',
        decisionDirector: decision,
        fechaDecisionDirector: serverTimestamp(),
        nombreDirector: profile.nombre,
        observacionDirector: observacionDirector,
        fechaInicio: fechaInicio,
        fechaTermino: fechaTermino,
        updatedAt: serverTimestamp(),
      };

      if (firmaData) {
         updateData.firmaDirector = firmaData;
      }
      if (selloDigitalDirector) {
        updateData.selloDigitalDirector = selloDigitalDirector;
      }

      await updateDoc(doc(db, 'reemplazos', reemplazo.id), updateData);
      onSuccess();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'reemplazos');
      setLoading(false);
    }
  };

  const handleClearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
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
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
             <div className="bg-blue-100 p-2 rounded-xl text-blue-700">
                <FileEdit size={24} />
             </div>
             <div>
               <h2 className="text-xl font-bold text-slate-900">{readOnly ? 'Detalle de Reemplazo' : 'Evaluar Reemplazo'}</h2>
               <p className="text-sm font-medium text-slate-500">{readOnly ? 'Vista de solo lectura' : 'Dirección'}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
           {error && (
             <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
               <AlertCircle size={20} />
               <p className="text-sm font-bold">{error}</p>
             </div>
           )}

           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
              <div>
                 <span className="text-xs uppercase font-bold text-slate-400">Funcionario a Reemplazar</span>
                 <p className="font-bold text-slate-800">{reemplazo.nombreFuncionario}</p>
                 <p className="text-sm font-semibold text-slate-500">{reemplazo.cargoFuncionario}</p>
              </div>
              <div className="h-px bg-slate-200"></div>
              <div>
                 <span className="text-xs uppercase font-bold text-slate-400">Reemplazante propuesto</span>
                 <p className="font-bold text-slate-800">{reemplazo.nombreReemplazante}</p>
                 <p className="text-sm font-semibold text-slate-500">{reemplazo.profesionReemplazante}</p>
              </div>
              <div className="h-px bg-slate-200"></div>
              <div>
                 <span className="text-xs uppercase font-bold text-slate-400">Motivo</span>
                 <p className="font-bold text-slate-800">{reemplazo.motivo} {reemplazo.observacionMotivo ? `- ${reemplazo.observacionMotivo}` : ''}</p>
              </div>
           </div>

           <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2">
                <Calendar size={16} className="text-blue-500"/>
                Período Autorizado
              </h3>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Desde</label>
                    <input 
                       type="date"
                       className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-slate-800 font-bold disabled:opacity-75"
                       value={fechaInicio}
                       disabled={readOnly}
                       onChange={e => setFechaInicio(e.target.value)}
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Hasta</label>
                    <input 
                       type="date"
                       className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-slate-800 font-bold disabled:opacity-75"
                       value={fechaTermino}
                       disabled={readOnly}
                       onChange={e => setFechaTermino(e.target.value)}
                    />
                 </div>
              </div>
              
              {fechaInicio && fechaTermino && (
                <div className="bg-blue-50/50 border border-blue-100 p-2 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Briefcase size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Días Laborales</span>
                  </div>
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-xs font-black shadow-sm">
                    {calculateBusinessDaysChile(fechaInicio, fechaTermino)} Días
                  </span>
                </div>
              )}
              
              {!readOnly && <p className="text-xs text-slate-500 font-medium">Puede editar estas fechas si requiere ajustar el período autorizado.</p>}
           </div>

           <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Observación {readOnly ? '' : '(Opcional)'}</label>
              <textarea 
                 rows={3}
                 className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 font-medium disabled:opacity-75"
                 placeholder={readOnly ? '' : "Ej. Se autoriza por necesidades del servicio..."}
                 value={observacionDirector}
                 disabled={readOnly}
                 onChange={e => setObservacionDirector(e.target.value)}
              />
           </div>

           {readOnly && reemplazo.firmaDirector && (
             <div className="space-y-4">
                <div className="h-px bg-slate-200"></div>
                <div className="space-y-2">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      Firma / Sello de Dirección
                   </p>
                   <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
                      <img src={reemplazo.firmaDirector} alt="Firma Director" className="max-h-32 object-contain" />
                      {reemplazo.selloDigitalDirector && (
                        <div className="mt-2 pt-2 border-t border-slate-100 w-full text-center">
                           <p className="text-[10px] font-mono text-slate-400 select-all">{reemplazo.selloDigitalDirector}</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
           )}

           {!readOnly && (
             <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Firma Director * (Solo para Aprobar)</label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                  <button 
                    type="button"
                    onClick={() => setSignatureType('sello')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${signatureType === 'sello' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Sello
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSignatureType('tactil')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${signatureType === 'tactil' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Firma
                  </button>
                </div>
              </div>

              {signatureType === 'sello' ? (
                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <Save size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-blue-800 text-xs">Sello Dirección Digital</p>
                    <p className="text-[10px] text-blue-600 font-medium">Se generará marca institucional de Dirección.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                    <SignatureCanvas 
                      ref={sigCanvas}
                      penColor="#0f172a"
                      canvasProps={{ className: 'w-full h-32 cursor-crosshair' }} 
                    />
                  </div>
                  <div className="flex justify-end mt-2">
                    <button type="button" onClick={handleClearSignature} className="text-xs text-slate-500 hover:text-slate-700 font-semibold px-3 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                      Limpiar Firma
                    </button>
                  </div>
                </>
              )}
           </div>
           )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 sticky bottom-0 z-10">
           {readOnly ? (
             <div className="w-full flex gap-3">
               <button 
                 onClick={onClose}
                 className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 font-bold hover:bg-slate-200 transition-colors"
               >
                 Cerrar
               </button>
               <button 
                 onClick={() => {
                   // This is a bit tricky since we don't have the PDF modal here easily
                   // We'll rely on the parent or adding it here if needed.
                   // For now, let's just use the onSuccess callback to signal a PDF view request if needed
                   // Or better, since it's a modal, the parent should handle the PDF.
                   // Let's add a local state for PDF preview in this modal too for better UX
                   setShowPdf(true);
                 }}
                 className="flex-1 bg-red-600 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-red-700 transition-colors"
               >
                 <Download size={18} />
                 Ver PDF
               </button>
             </div>
           ) : (
             <>
               <button 
                  onClick={() => handleDecision('Rechazado')}
                  disabled={loading}
                  className="flex-1 bg-white border border-red-200 text-red-600 rounded-xl py-3 font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
               >
                  <XCircle size={18} />
                  Rechazar
               </button>
               <button 
                  onClick={() => handleDecision('Autorizado')}
                  disabled={loading}
                  className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 shadow-sm shadow-emerald-200 hover:bg-emerald-700 transition-colors"
               >
                  <Check size={18} />
                  Aprobar
               </button>
             </>
           )}
        </div>
      </motion.div>

      {showPdf && (
        <PDFPreviewModal 
          reemplazo={reemplazo}
          isOpen={showPdf}
          onClose={() => setShowPdf(false)}
          type="reemplazo"
        />
      )}
    </div>
  );
}
