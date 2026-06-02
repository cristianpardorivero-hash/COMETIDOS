import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, FileText, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { Cometido, Reemplazo } from '../types';
import { generateCometidoPDF, generateResolucionPDF, generateReemplazoPDF } from '../services/pdfService';

interface PDFPreviewModalProps {
  cometido?: Cometido;
  reemplazo?: Reemplazo;
  isOpen: boolean;
  onClose: () => void;
  type?: 'solicitud' | 'resolucion' | 'reemplazo';
}

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({ cometido, reemplazo, isOpen, onClose, type = 'solicitud' }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const generate = async () => {
        setLoading(true);
        try {
          // Clean up previous URL if it exists
          if (pdfUrl && pdfUrl.startsWith('blob:')) {
            URL.revokeObjectURL(pdfUrl);
          }

          let doc;
          if (type === 'reemplazo' && reemplazo) {
            doc = await generateReemplazoPDF(reemplazo);
          } else if (cometido) {
            doc = type === 'resolucion' 
              ? await generateResolucionPDF(cometido) 
              : await generateCometidoPDF(cometido);
          }
          
          if (doc) {
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
          }
        } catch (error) {
          console.error(`Error generating ${type} preview:`, error);
        } finally {
          setLoading(false);
        }
      };
      generate();
    } else {
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfUrl(null);
    }

    return () => {
      // Final cleanup on unmount
    };
  }, [isOpen, cometido, reemplazo, type]);

  // Handle manual cleanup on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, []);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    
    let fileName = '';
    if (type === 'reemplazo' && reemplazo) {
      fileName = `Solicitud_Reemplazo_${reemplazo.nombreFuncionario}.pdf`;
    } else if (cometido) {
      fileName = type === 'resolucion' 
        ? `Resolucion_${cometido.resolucionAdministrativa || 'Borrador'}_${cometido.nombreFuncionario}.pdf`
        : `Solicitud_Cometido_${cometido.nombreFuncionario}.pdf`;
    }
    
    link.download = fileName.replace(/\s+/g, '_');
    link.click();
  };

  const getTitle = () => {
    if (type === 'reemplazo') return 'Solicitud de Reemplazo';
    return type === 'resolucion' ? 'Resolución Administrativa' : 'Solicitud de Cometido';
  };

  const getReferenceId = () => {
    if (type === 'reemplazo' && reemplazo) return reemplazo.id.substring(0, 8);
    if (cometido) return cometido.id.substring(0, 8);
    return '';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 md:p-8 bg-slate-900/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`bg-white rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
              isFullscreen ? 'w-full h-full' : 'w-full max-w-5xl h-[90vh]'
            }`}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 text-red-600 p-2 rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Previsualización: {getTitle()}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Referencia #{getReferenceId()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (pdfUrl) {
                      const win = window.open(pdfUrl, '_blank');
                      if (!win) {
                        alert('Por favor permite las ventanas emergentes para ver el PDF en pantalla completa.');
                      }
                    }
                  }}
                  className="hidden md:flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all active:scale-95"
                  title="Abrir en nueva pestaña"
                >
                  <Maximize2 size={14} /> Abrir en navegador
                </button>
                <button
                  onClick={handleDownload}
                  className="hidden sm:flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-100"
                >
                  <Download size={14} /> Descargar
                </button>
                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-all shrink-0"
                    title={isFullscreen ? "Contraer" : "Expandir"}
                  >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-red-100 hover:text-red-600 rounded-full text-slate-500 transition-all shrink-0"
                    title="Cerrar"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Viewer */}
            <div className="flex-1 bg-slate-100 relative overflow-hidden">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="text-blue-600 animate-spin" size={40} />
                  <p className="text-sm font-bold text-slate-500">Generando documento...</p>
                </div>
              ) : pdfUrl ? (
                <div className="w-full h-full relative">
                  <iframe
                    key={pdfUrl}
                    src={pdfUrl}
                    title="Previsualización de PDF"
                    className="w-full h-full border-none"
                  />
                  {/* Fallback overlay in case iframe doesn't show properly in some browsers */}
                  <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-8 opacity-0 hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => window.open(pdfUrl, '_blank')}
                      className="pointer-events-auto bg-slate-900 text-white px-6 py-3 rounded-full font-bold text-xs shadow-2xl flex items-center gap-2"
                    >
                      <Maximize2 size={14} /> ¿No ves el PDF? Abrir en el Navegador
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <FileText className="text-slate-300" size={60} />
                  <p className="text-sm font-bold text-slate-500">Error al cargar la previsualización</p>
                </div>
              )}
            </div>

            {/* Footer Mobile Only */}
            <div className="sm:hidden p-4 border-t border-slate-100 bg-white">
               <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg"
                >
                  <Download size={18} /> Descargar Documento
                </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PDFPreviewModal;
