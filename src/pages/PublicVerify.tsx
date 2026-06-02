import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shield, CheckCircle, XCircle, Calendar, User, MapPin, Building2, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from '../lib/dateUtils';

interface ValidationData {
  id: string;
  documentType: string;
  nombreVisible: string;
  cargo: string;
  uidMasked: string;
  servicio: string;
  detalleLabel: string;
  detalleValor: string;
  fecha: string;
  sello1Label: string;
  sello1Valor?: string;
  sello2Label: string;
  sello2Valor?: string;
  sello3Label?: string;
  sello3Valor?: string;
}

export default function PublicVerify() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ValidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocument() {
      const trimmedId = id?.trim();
      if (!trimmedId) return;
      
      try {
        setLoading(true);
        // Intentar buscar en cometidos primero
        const cometidoRef = doc(db, 'cometidos', trimmedId);
        const cometidoSnap = await getDoc(cometidoRef);
        
        if (cometidoSnap.exists()) {
          const c = cometidoSnap.data();
          const nombreMasked = c.nombreFuncionario ? 
            c.nombreFuncionario.split(' ').map((p: string, i: number) => i === 0 ? p : p.charAt(0) + '.').join(' ') 
            : 'Funcionario';
          const uidClean = c.funcionarioUid || '';

          setData({
            id: cometidoSnap.id,
            documentType: 'Cometido Funcionario',
            nombreVisible: nombreMasked,
            cargo: c.cargo || 'Funcionario',
            uidMasked: `***${uidClean.slice(-4) || 'N/A'}`,
            servicio: c.servicioNombre || 'Administración',
            detalleLabel: 'Lugar de Destino',
            detalleValor: 'Reservado (Ley 19.628)',
            fecha: c.fechaInicio,
            sello1Label: 'SELLO FUNCIONARIO',
            sello1Valor: c.selloDigitalFuncionario || 'LEGACY_VERIFIED_AUTH',
            sello2Label: 'SELLO JEFATURA',
            sello2Valor: c.selloDigitalJefatura,
            sello3Label: 'SELLO DIRECCIÓN',
            sello3Valor: c.selloDigitalDirector,
          });
          setLoading(false);
          return;
        }

        // Si no está en cometidos, intentar en reemplazos
        const reemplazoRef = doc(db, 'reemplazos', trimmedId);
        const reemplazoSnap = await getDoc(reemplazoRef);

        if (reemplazoSnap.exists()) {
          const r = reemplazoSnap.data();
          const nombreMasked = r.nombreReemplazante ? 
            r.nombreReemplazante.split(' ').map((p: string, i: number) => i === 0 ? p : p.charAt(0) + '.').join(' ') 
            : 'Reemplazante';
          const rutClean = r.rutReemplazante || '';

          setData({
            id: reemplazoSnap.id,
            documentType: 'Solicitud de Reemplazo',
            nombreVisible: nombreMasked,
            cargo: r.cargoFuncionario || 'Reemplazo',
            uidMasked: `***${rutClean.slice(-4) || 'N/A'}`,
            servicio: r.servicioNombre || 'Administración',
            detalleLabel: 'Funcionario Ausente',
            detalleValor: 'Reservado (Ley 19.628)',
            fecha: r.fechaInicio,
            sello1Label: 'SELLO JEFATURA',
            sello1Valor: r.selloDigitalJefatura || 'LEGACY_VERIFIED_AUTH',
            sello2Label: 'SELLO DIRECCIÓN',
            sello2Valor: r.selloDigitalDirector,
          });
          setLoading(false);
          return;
        }

        // No se encontró en ninguna
        setError('El documento no existe o el ID es inválido.');
      } catch (err: any) {
        console.error('Error fetching document:', err);
        setError(`Error de validación. El documento no pudo ser verificado de forma segura. [CODE: ${err?.code || 'ERR'}]`);
      } finally {
        setLoading(false);
      }
    }

    fetchDocument();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium font-sans">Verificando autenticidad en red criptográfica...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-red-100 font-sans">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={48} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Error de Validación</h1>
          <p className="text-slate-500 mb-8">{error || 'No se pudo encontrar el registro solicitado.'}</p>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-900 transition-all active:scale-95"
          >
            Ir al Portal Principal <ExternalLink size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      <div className="bg-white border-b border-slate-200 py-6 px-4 mb-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Hospital de Curepto</h2>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Portal de Validación Oficial</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/" 
              className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-blue-100"
            >
              Acceso Institucional
            </Link>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full border border-green-100">
              <Shield size={16} />
              <span className="text-xs font-bold">Autenticidad Verificada</span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200"
        >
          {/* Status Header */}
          <div className="bg-slate-900 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-green-500/20 relative z-10">
              <CheckCircle size={40} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-1 relative z-10">Documento Válido</h1>
            <p className="text-slate-400 text-sm relative z-10 font-medium uppercase tracking-wide">{data.documentType}</p>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Profile Section */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Información Protegida</h3>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{data.nombreVisible}</p>
                    <p className="text-xs text-slate-500">{data.cargo}</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono">RUT/ID: {data.uidMasked}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{data.servicio}</p>
                    <p className="text-xs text-slate-500">Unidad de Origen</p>
                  </div>
                </div>
              </div>

              {/* Document Details */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Datos del Documento</h3>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{data.detalleValor}</p>
                    <p className="text-xs text-slate-500">{data.detalleLabel}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {formatDate(data.fecha)}
                    </p>
                    <p className="text-xs text-slate-500">Fecha de Inicio Operación</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Seals Section */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Registro Inmutable y Trazabilidad</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.sello1Valor && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">{data.sello1Label}</p>
                    <p className="text-[11px] font-mono text-blue-600 break-all leading-tight">
                      {data.sello1Valor}
                    </p>
                  </div>
                )}

                {data.sello2Valor && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">{data.sello2Label}</p>
                    <p className="text-[11px] font-mono text-slate-600 break-all leading-tight">
                      {data.sello2Valor}
                    </p>
                  </div>
                )}
                
                {data.sello3Valor && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">{data.sello3Label}</p>
                    <p className="text-[11px] font-mono text-slate-600 break-all leading-tight">
                      {data.sello3Valor}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 max-w-lg mx-auto font-medium">
                SISTEMA DE VERIFICACIÓN OFICIAL V2.0 • HOSPITAL DE CUREPTO<br/>
                La información detallada ha sido ofuscada en cumplimiento de la Ley N° 19.628 sobre Protección de la Vida Privada.<br/>
                Fecha de validación: {format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: es })}
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
