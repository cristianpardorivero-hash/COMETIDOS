import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { Cometido, HistorialCometido, CometidoEstado } from "../types";
import {
  X,
  MapPin,
  Calendar,
  Clock,
  Truck,
  User,
  Hospital,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  BadgeInfo,
  DollarSign,
  Download,
  ChevronRight,
  PenTool,
  Shield,
  Trash2,
  Maximize2,
  AlertTriangle,
} from "lucide-react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatDate } from "../lib/dateUtils";
import { calculateViatico, getTierForGrado } from "../lib/viaticoUtils";
import { sendNotification } from "../lib/notifications";
import SignatureCanvas from 'react-signature-canvas';
import { generateCometidoPDF, generateResolucionPDF } from "../services/pdfService";
import PDFPreviewModal from "./PDFPreviewModal";
import CometidoForm from "./CometidoForm";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  cometido: Cometido;
  onClose: () => void;
  onUpdate: () => void;
}

const CometidoDetail: React.FC<Props> = ({ cometido, onClose, onUpdate }) => {
  const { profile } = useAuth();
  
  // Compute actingRole dynamically based on user's current array of roles and the state of the document
  let actingRole = profile?.roles?.[0] || 'Visitante';
  const userRoles = profile?.roles || [];
  if (userRoles.includes("Administrador")) {
    actingRole = "Administrador";
    if (cometido.estado === "Pendiente revisión jefatura") actingRole = "Jefatura de Servicio";
    else if (cometido.estado === "Pendiente revisión Dirección") actingRole = "Director";
    else if (cometido.estado === "En revisión por Personal" || cometido.estado === "Autorizado por Dirección") actingRole = "Personal";
    else if (cometido.estado === "En revisión por Finanzas" || cometido.estado === "Pendiente de pago") actingRole = "Finanzas";
  } else {
    if (cometido.estado === "Pendiente revisión jefatura" && 
        userRoles.includes("Jefatura de Servicio") && 
        (cometido.jefaturaUid === profile?.uid || (!cometido.jefaturaUid && cometido.servicioId === profile?.servicioId))
    ) {
      actingRole = "Jefatura de Servicio";
    }
    else if (cometido.estado === "Pendiente revisión Dirección" && userRoles.includes("Director")) actingRole = "Director";
    else if ((cometido.estado === "En revisión por Personal" || cometido.estado === "Autorizado por Dirección") && userRoles.includes("Personal")) actingRole = "Personal";
    else if ((cometido.estado === "En revisión por Finanzas" || cometido.estado === "Pendiente de pago") && userRoles.includes("Finanzas")) actingRole = "Finanzas";
  }

  const [historial, setHistorial] = useState<HistorialCometido[]>([]);
  const [loading, setLoading] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "history">("info");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<"solicitud" | "resolucion">("solicitud");
  const [isEditing, setIsEditing] = useState(false);
  const [resolucionInput, setResolucionInput] = useState("");
  const approverSigPad = useRef<SignatureCanvas>(null);
  
  const [pendingAction, setPendingAction] = useState<{
    decision: "Aprobado" | "Rechazado" | "Devuelto",
    targetEstado: CometidoEstado,
  } | null>(null);

  const handleExportPDF = async () => {
    const doc = await generateCometidoPDF(cometido);
    doc.save(`Cometido_${(cometido.nombreFuncionario || '').replace(/\s+/g, "_")}_${cometido.id.substring(0, 5)}.pdf`);
  };

  const handleExportResolucion = async () => {
    const doc = await generateResolucionPDF(cometido);
    const resNumber = cometido.resolucionAdministrativa ? cometido.resolucionAdministrativa.replace(/\//g, "-") : "Borrador";
    doc.save(`Resolucion_${resNumber}_${(cometido.nombreFuncionario || '').replace(/\s+/g, "_")}.pdf`);
  };

  // Finanzas specialized fields
  const [finanzasData, setFinanzasData] = useState({
    correspondeViatico: true,
    montoEstimado: 0,
    montoPagado: 0,
    fechaPago: "",
    medioPago: "Transferencia",
    comprobantePago: "",
  });

  // Calculate suggested viatico for Finanzas
  useEffect(() => {
    if ((actingRole === "Finanzas") && cometido.estado === "En revisión por Finanzas" && finanzasData.montoPagado === 0) {
      const calculation = calculateViatico(
        cometido.grado,
        cometido.fechaInicio,
        cometido.fechaTermino,
        cometido.pernoctado
      );
      
      if (calculation.total > 0) {
        setFinanzasData(prev => ({
          ...prev,
          montoPagado: calculation.total
        }));
      }
    }
  }, [actingRole, cometido.id, cometido.grado, cometido.fechaInicio, cometido.fechaTermino]);

  useEffect(() => {
    const fetchHistorial = async () => {
      const q = query(
        collection(db, "historial_cometidos"),
        where("cometidoId", "==", cometido.id),
        orderBy("fecha", "desc"),
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as HistorialCometido,
      );
      setHistorial(docs);
    };
    fetchHistorial();
  }, [cometido.id]);

  const executePendingAction = async () => {
    if (!profile || !pendingAction) return;
    setLoading(true);
    const { decision, targetEstado } = pendingAction;

    try {
      const docRef = doc(db, "cometidos", cometido.id);
      const selloDigital = `AUTH_GID_${profile.uid.substring(0, 12).toUpperCase()}_${new Date().getTime().toString(16).toUpperCase()}`;
      const updateData: any = {
        estado: targetEstado,
        updatedAt: serverTimestamp(),
      };

      // Add specific fields based on role
      // actingRole is computed at top of component

      if (actingRole === "Jefatura de Servicio" || (userRoles.includes("Administrador") && (cometido.estado === "Pendiente revisión jefatura" || targetEstado === "Pendiente revisión Dirección" || targetEstado === "Rechazado por jefatura" || targetEstado === "Devuelto por jefatura"))) {
        updateData.jefaturaUid = profile.uid;
        updateData.decisionJefatura = decision;
        updateData.fechaDecisionJefatura = serverTimestamp();
        updateData.observacionJefatura = observacion;
        updateData.firmaJefatura = approverSigPad.current?.toDataURL('image/png');
        updateData.selloDigitalJefatura = selloDigital;
        updateData.nombreJefatura = profile.nombre;
        updateData.rutJefatura = profile.rut;
        updateData.cargoJefatura = profile.cargo;
      } else if (actingRole === "Director" || (userRoles.includes("Administrador") && (cometido.estado === "Pendiente revisión Dirección" || targetEstado === "En revisión por Personal" || targetEstado === "Rechazado por Dirección" || targetEstado === "Devuelto por Dirección"))) {
        updateData.decisionDirector = decision;
        updateData.fechaDecisionDirector = serverTimestamp();
        updateData.observacionDirector = observacion;
        updateData.firmaDirector = approverSigPad.current?.toDataURL('image/png');
        updateData.selloDigitalDirector = selloDigital;
        updateData.nombreDirector = profile.nombre;
        updateData.rutDirector = profile.rut;
        updateData.cargoDirector = profile.cargo;
      } else if (actingRole === "Personal" || (userRoles.includes("Administrador") && (cometido.estado === "En revisión por Personal" || targetEstado === "En revisión por Finanzas" || targetEstado === "No corresponde pago" || targetEstado === "Rechazado por Personal"))) {
        if (decision === "Aprobado" && !cometido.resolucionAdministrativa) {
          if (resolucionInput) {
            updateData.resolucionAdministrativa = resolucionInput;
          } else {
            // Generación AUTOMÁTICA de resolución
            const year = new Date().getFullYear();
            const counterId = `resoluciones-${year}`;
            const counterRef = doc(db, "counters", counterId);
            
            try {
              const resNum = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextNum = 1;
                
                if (counterDoc.exists()) {
                  nextNum = counterDoc.data().lastNumber + 1;
                  transaction.update(counterRef, { lastNumber: nextNum });
                } else {
                  transaction.set(counterRef, { lastNumber: 1, year: year });
                }
                
                return `HC${String(nextNum).padStart(5, '0')}/${year}`;
              });
              
              updateData.resolucionAdministrativa = resNum;
            } catch (err) {
              console.error("Error generating resolution number:", err);
              alert("Error al generar el número de resolución automático.");
              setLoading(false);
              return;
            }
          }
        }
        updateData.revisionPersonal = decision;
        updateData.fechaRevisionPersonal = serverTimestamp();
        updateData.observacionPersonal = observacion;
      } else if (actingRole === "Finanzas" || (userRoles.includes("Administrador") && (cometido.estado === "En revisión por Finanzas" || cometido.estado === "Pendiente de pago" || targetEstado === "Pagado" || targetEstado === "Rechazado por Finanzas"))) {
        updateData.observacionFinanzas = observacion;
        if (targetEstado === "Pagado") {
          Object.assign(updateData, finanzasData);
        }
      }

      await updateDoc(docRef, updateData);

      // Log history
      await addDoc(collection(db, "historial_cometidos"), {
        cometidoId: cometido.id,
        fecha: serverTimestamp(),
        usuarioUid: profile.uid,
        usuarioNombre: profile.nombre,
        rol: actingRole,
        accion: decision,
        estadoAnterior: cometido.estado,
        estadoNuevo: targetEstado,
        observacion: observacion,
      });

      // Refresh local state for the tab
      const newLog = {
        id: "temp-" + Date.now(),
        cometidoId: cometido.id,
        fecha: { toDate: () => new Date() },
        usuarioUid: profile.uid,
        usuarioNombre: profile.nombre,
        rol: actingRole,
        accion: decision,
        estadoAnterior: cometido.estado,
        estadoNuevo: targetEstado,
        observacion: observacion,
      } as any;
      setHistorial([newLog, ...historial]);

      // Notificar al dueño del cometido
      if (profile.uid !== cometido.funcionarioUid) {
        await sendNotification(
          cometido.funcionarioUid,
          `Actualización Cometido ${cometido.ciudad}`,
          `El estado de tu cometido ha cambiado a: ${targetEstado}.`,
          'my-cometidos'
        );
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error al actualizar el estado.");
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  const getTimelineDate = (dateDoc: any) => {
    if (!dateDoc) return null;
    if (dateDoc.toDate)
      return format(dateDoc.toDate(), "dd/MM/yyyy, HH:mm", { locale: es });
    return null;
  };

  const getStepStatus = (index: number) => {
    const currentState = cometido.estado;
    const statesMap: Record<CometidoEstado, number> = {
      "Borrador": -1,
      "Pendiente revisión jefatura": 0,
      "Devuelto por jefatura": 0,
      "Rechazado por jefatura": 0,
      "Aprobado por jefatura": 1,
      "Pendiente revisión Dirección": 1,
      "Devuelto por Dirección": 1,
      "Rechazado por Dirección": 1,
      "Autorizado por Dirección": 2,
      "En revisión por Personal": 2,
      "Rechazado por Personal": 2,
      "En revisión por Finanzas": 3,
      "Pendiente de pago": 4,
      "Rechazado por Finanzas": 3,
      "Pagado": 4,
      "No corresponde pago": 4,
      "Devuelto para corrección": -1,
      "Rechazado": -1,
      "Finalizado": 4
    };

    const currentStepIndex = statesMap[currentState as CometidoEstado] ?? 0;

    if (index < currentStepIndex) return "completed";
    if (index === currentStepIndex) return "current";
    return "pending";
  };

  const steps = [
    { id: 0, label: "Jefatura" },
    { id: 1, label: "Dirección" },
    { id: 2, label: "Personal" },
    { id: 3, label: "Finanzas" },
    { id: 4, label: "Pago" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-hidden">
      <motion.div
        layoutId={cometido.id}
        className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col h-full max-h-[90vh] overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg">
              <FileText size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900 line-clamp-1">
                  {cometido.motivo}
                </h2>
                <span className="text-xs font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                  #{cometido.id.substring(0, 8)}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-slate-500 font-medium text-xs">
                <span className="flex items-center gap-1">
                  <User size={12} /> {cometido.nombreFuncionario}
                </span>
                <span className="flex items-center gap-1">
                  <Hospital size={12} /> {cometido.servicioNombre}
                </span>
                <span
                  className={`status-badge ${cometido.estado.includes("Aprobado") ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
                >
                  {cometido.estado}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Multi-step indicator */}
        <div className="px-8 py-4 bg-white border-b border-slate-100 hidden sm:block">
          <div className="flex items-center justify-between px-12 relative">
            <div className="absolute left-[10%] right-[10%] top-4 h-0.5 bg-slate-100 -z-10" />
            {steps.map((step, i) => {
              const status = getStepStatus(i);
              return (
                <div key={step.id} className="flex flex-col items-center relative z-10 w-20">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 shadow-sm ${
                      status === "completed"
                        ? "bg-green-500 border-green-100 text-white"
                        : status === "current"
                        ? "bg-blue-600 border-blue-100 text-white shadow-blue-200"
                        : "bg-white border-slate-200 text-slate-300"
                    }`}
                  >
                    {status === "completed" ? (
                      <CheckCircle2 size={14} strokeWidth={3} />
                    ) : (
                      <span className="text-[10px] font-bold">{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-tighter mt-2 text-center w-full ${
                      status === "completed"
                        ? "text-green-600"
                        : status === "current"
                        ? "text-blue-600"
                        : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-8 py-4 font-bold text-sm transition-all relative ${activeTab === "info" ? "text-blue-600" : "text-slate-500"}`}
          >
            Detalles del Cometido
            {activeTab === "info" && (
              <motion.div
                layoutId="tab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-8 py-4 font-bold text-sm transition-all relative ${activeTab === "history" ? "text-blue-600" : "text-slate-500 mr-auto"}`}
          >
            Historial de Cambios
            {activeTab === "history" && (
              <motion.div
                layoutId="tab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"
              />
            )}
          </button>
          <div className="pr-8 flex items-center gap-6">
            <button
              onClick={() => { setPreviewType("solicitud"); setIsPreviewOpen(true); }}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-xs font-bold uppercase transition-colors"
            >
              <Maximize2 size={14} /> Ver Solicitud
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase transition-colors"
            >
              <Download size={14} /> Descargar Solicitud
            </button>
            {['Autorizado por Dirección', 'En revisión por Personal', 'En revisión por Finanzas', 'Pendiente de pago', 'Pagado', 'Finalizado', 'No corresponde pago'].includes(cometido.estado) && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPreviewType("resolucion"); setIsPreviewOpen(true); }}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-xs font-bold uppercase transition-colors px-3 py-1 bg-indigo-50 rounded-lg"
                >
                  <Maximize2 size={14} /> Ver Resolución
                </button>
                <button
                  onClick={handleExportResolucion}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-xs font-bold uppercase transition-colors px-3 py-1 bg-indigo-100 rounded-lg"
                >
                  <Download size={14} /> Resolución
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "info" ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Details Column */}
              <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 border-l-4 border-blue-500 pl-3">
                      Información de Desplazamiento
                    </h4>
                    <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="text-blue-600 shrink-0" size={18} />
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            Destino
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {cometido.destino}, {cometido.ciudad}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Calendar
                          className="text-blue-600 shrink-0"
                          size={18}
                        />
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            Periodo
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            Del {formatDate(cometido.fechaInicio)} al{" "}
                            {formatDate(cometido.fechaTermino)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Clock className="text-blue-600 shrink-0" size={18} />
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            Horario
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {cometido.horaInicio} hrs - {cometido.horaTermino}{" "}
                            hrs
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 border-l-4 border-indigo-500 pl-3">
                      Logística y Transporte
                    </h4>
                    <div className="bg-slate-50 rounded-2xl p-5 space-y-4 text-sm font-medium">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Truck size={16} />
                          <span>Medio</span>
                        </div>
                        <span className="font-bold text-slate-900">
                          {cometido.medioTransporte}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Traslado Inst.</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${cometido.requiereTraslado ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}
                        >
                          {cometido.requiereTraslado ? "SÍ" : "NO"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Fuera de Curepto</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${cometido.fueraDeCurepto ? "bg-orange-100 text-orange-700" : "bg-slate-200 text-slate-500"}`}
                        >
                          {cometido.fueraDeCurepto ? "SÍ" : "NO"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Cálculo Distancia</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${cometido.aplicaDistancia ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-500"}`}
                        >
                          {cometido.aplicaDistancia ? "SÍ" : "NO"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-bold">¿Pernoctado?</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${cometido.pernoctado ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"}`}
                        >
                          {cometido.pernoctado ? "SÍ" : "NO"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-bold">
                          Derecho Viático
                        </span>
                        <span
                          className={`status-badge ${cometido.posibleViatico === "Sí" ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-600"}`}
                        >
                          {cometido.posibleViatico}
                        </span>
                      </div>
                    </div>
                  </div>

                  {cometido.resolucionAdministrativa && (
                    <div className="space-y-4">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 border-l-4 border-indigo-600 pl-3">
                        Resolución Administrativa
                      </h4>
                      <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-indigo-400">Número de Resolución</p>
                          <p className="text-lg font-black text-indigo-900">{cometido.resolucionAdministrativa}</p>
                        </div>
                        <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-indigo-600">
                          <FileText size={24} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 border-l-4 border-slate-900 pl-3">
                    Firma Digital y Validación
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* Firma Funcionario */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-3 self-start">
                        Firma del Funcionario
                      </p>
                      {cometido.firmaFuncionario ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-2 w-full flex justify-center">
                          <img src={cometido.firmaFuncionario} alt="Firma Funcionario" className="max-h-24 object-contain" />
                        </div>
                      ) : (
                        <div className="bg-slate-100 rounded-xl border border-dashed border-slate-300 p-8 w-full flex flex-col items-center justify-center text-slate-400">
                           <PenTool size={24} className="mb-2" />
                           <span className="text-xs font-medium">Sin firma registrada</span>
                        </div>
                      )}
                      <div className="mt-4 w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg border border-green-100">
                          <Shield size={14} />
                          <span className="text-[10px] font-bold">Autenticado por Google Auth</span>
                        </div>
                        {cometido.selloDigitalFuncionario && (
                          <div className="flex gap-2">
                             <div className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                                <p className="text-[9px] font-mono break-all leading-tight">
                                  Sello: {cometido.selloDigitalFuncionario}
                                </p>
                             </div>
                             <div className="bg-white p-1 rounded border border-slate-200 flex-shrink-0">
                               <QRCodeSVG 
                                 value={`${window.location.origin}/verify/${cometido.id}`}
                                 size={32}
                               />
                             </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Firma Jefatura */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-3 self-start">
                        Firma Jefatura Directa
                      </p>
                      {cometido.firmaJefatura ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-2 w-full flex justify-center relative">
                          <img src={cometido.firmaJefatura} alt="Firma Jefatura" className="max-h-24 object-contain" />
                          <div className="absolute top-1 right-1 bg-green-500 rounded-full text-white p-0.5"><CheckCircle2 size={12}/></div>
                        </div>
                      ) : (
                        <div className="bg-slate-100 rounded-xl border border-dashed border-slate-300 p-8 w-full flex flex-col items-center justify-center text-slate-400">
                           <Shield size={24} className="mb-2" />
                           <span className="text-xs font-medium">Pendiente / No requiere</span>
                        </div>
                      )}
                      <div className="mt-4 w-full">
                         {cometido.selloDigitalJefatura ? (
                           <div className="bg-slate-100 p-2 rounded border border-slate-200">
                             <div className="flex gap-2">
                               <div className="flex-1">
                                 <p className="text-[9px] font-mono text-slate-600 break-all leading-tight">
                                   VERIF: {cometido.selloDigitalJefatura}
                                 </p>
                                 <p className="text-[8px] text-slate-400 mt-1 font-bold italic uppercase tracking-tighter">Sello Jefatura</p>
                               </div>
                               <div className="bg-white p-1 rounded border border-slate-200 flex-shrink-0">
                                 <QRCodeSVG value={`${window.location.origin}/verify/${cometido.id}`} size={32} />
                               </div>
                             </div>
                           </div>
                         ) : (
                           <p className="text-[9px] font-mono text-slate-300 break-all bg-slate-100 p-2 rounded text-center py-4">A la espera de validación</p>
                         )}
                      </div>
                    </div>

                    {/* Firma Director */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center xl:col-span-1 md:col-span-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-3 self-start">
                        Firma Dirección
                      </p>
                      {cometido.firmaDirector ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-2 w-full flex justify-center relative">
                          <img src={cometido.firmaDirector} alt="Firma Director" className="max-h-24 object-contain" />
                          <div className="absolute top-1 right-1 bg-green-500 rounded-full text-white p-0.5"><CheckCircle2 size={12}/></div>
                        </div>
                      ) : (
                        <div className="bg-slate-100 rounded-xl border border-dashed border-slate-300 p-8 w-full flex flex-col items-center justify-center text-slate-400">
                           <Shield size={24} className="mb-2" />
                           <span className="text-xs font-medium">Pendiente de aprobación</span>
                        </div>
                      )}
                      <div className="mt-4 w-full">
                         {cometido.selloDigitalDirector ? (
                           <div className="bg-slate-100 p-2 rounded border border-slate-200">
                             <div className="flex gap-2">
                               <div className="flex-1">
                                 <p className="text-[9px] font-mono text-slate-600 break-all leading-tight">
                                   VERIF: {cometido.selloDigitalDirector}
                                 </p>
                                 <p className="text-[8px] text-slate-400 mt-1 font-bold italic uppercase tracking-tighter">Sello Dirección</p>
                               </div>
                               <div className="bg-white p-1 rounded border border-slate-200 flex-shrink-0">
                                 <QRCodeSVG value={`${window.location.origin}/verify/${cometido.id}`} size={32} />
                               </div>
                             </div>
                           </div>
                         ) : (
                           <p className="text-[9px] font-mono text-slate-300 break-all bg-slate-100 p-2 rounded text-center py-4">A la espera de validación</p>
                         )}
                      </div>
                    </div>

                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 border-l-4 border-slate-900 pl-3">
                    Documentación y Observaciones
                  </h4>
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <p className="text-slate-600 text-sm leading-relaxed mb-6 italic">
                      "
                      {cometido.observacionesFuncionario ||
                        "Sin observaciones registradas por el funcionario."}
                      "
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {cometido.documentosAdjuntos.length > 0 ? (
                        cometido.documentosAdjuntos.map((_, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:border-blue-300 cursor-pointer transition-colors group"
                          >
                            <FileText className="text-slate-400 group-hover:text-blue-500" />
                            <span className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-tighter">
                              Respaldo {idx + 1}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-4 text-center text-slate-400 text-sm italic font-medium">
                          No se adjuntaron documentos
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Approvals/Actions Column */}
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                    <BadgeInfo size={14} /> Estado Actual
                  </h4>
                  <p className="text-2xl font-black mb-2">{cometido.estado}</p>

                  {/* Approvals List */}
                  <div className="space-y-3 mt-6">
                    <ApprovalItem
                      label="Jefatura"
                      approved={!!cometido.decisionJefatura}
                      date={getTimelineDate(cometido.fechaDecisionJefatura)}
                    />
                    <ApprovalItem
                      label="Director"
                      approved={!!cometido.decisionDirector}
                      date={getTimelineDate(cometido.fechaDecisionDirector)}
                    />
                    <ApprovalItem
                      label="Personal"
                      approved={!!cometido.revisionPersonal}
                      date={getTimelineDate(cometido.fechaRevisionPersonal)}
                    />
                    <ApprovalItem
                      label="Finanzas"
                      approved={
                        cometido.estado === "Pagado" ||
                        cometido.estado === "No corresponde pago"
                      }
                    />
                  </div>

                  {/* Funcionario Edit Button */}
                  {profile?.uid === cometido.funcionarioUid && 
                   (cometido.estado === 'Devuelto por jefatura' || 
                    cometido.estado === 'Devuelto por Dirección' || 
                    cometido.estado === 'Devuelto para corrección' || 
                    cometido.estado === 'Pendiente revisión jefatura' || 
                    cometido.estado === 'Borrador') && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="w-full mt-6 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                    >
                      <PenTool size={18} />
                      Editar Solicitud
                    </button>
                  )}
                </div>

                {/* Action Board - Visible only if user role matches flow */}
                {shouldShowActions(actingRole, cometido.estado) && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="institutional-card p-6 border-blue-100 bg-blue-50/20"
                  >
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="text-blue-600" size={18} />
                      Gestión Administrativa
                    </h4>

                    {actingRole === "Finanzas" &&
                      cometido.estado === "En revisión por Finanzas" && (
                        <div className="space-y-3 mb-4">
                          <div className="bg-blue-100/50 p-3 rounded-xl border border-blue-100 flex items-center gap-3">
                            <div className="bg-blue-600 text-white p-2 rounded-lg">
                              <DollarSign size={16} />
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Sugerencia de Cálculo (DS 262)</p>
                              <div className="flex items-baseline gap-2">
                                <p className="text-lg font-black text-slate-900">
                                  ${calculateViatico(cometido.grado, cometido.fechaInicio, cometido.fechaTermino, cometido.pernoctado).total.toLocaleString('es-CL')}
                                </p>
                                <span className="text-[10px] text-slate-500 font-bold">
                                  {calculateViatico(cometido.grado, cometido.fechaInicio, cometido.fechaTermino, cometido.pernoctado).days} días • {calculateViatico(cometido.grado, cometido.fechaInicio, cometido.fechaTermino, cometido.pernoctado).tierName} (Grado {cometido.grado || 'S/G'}) • {cometido.pernoctado ? '100% (Pernoctado)' : '40% (Sin Pernoctar)'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                              Monto a Pagar
                            </label>
                            <div className="relative">
                              <DollarSign
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                              />
                              <input
                                type="number"
                                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm font-bold"
                                value={finanzasData.montoPagado}
                                onChange={(e) =>
                                  setFinanzasData({
                                    ...finanzasData,
                                    montoPagado: Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                              Medio de Pago
                            </label>
                            <select
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm"
                              value={finanzasData.medioPago}
                              onChange={(e) =>
                                setFinanzasData({
                                  ...finanzasData,
                                  medioPago: e.target.value,
                                })
                              }
                            >
                              <option>Transferencia</option>
                              <option>Cheque</option>
                              <option>Efectivo</option>
                            </select>
                          </div>
                        </div>
                      )}

                    <div className="space-y-4">
                      {(actingRole === "Jefatura de Servicio" ||
                        actingRole === "Director" ||
                        actingRole === "Administrador") && (
                        <div className="space-y-2 mb-4">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">
                            Su Firma Digital
                          </label>
                          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-inner flex justify-center">
                            <SignatureCanvas
                              ref={approverSigPad}
                              penColor="#0f172a"
                              canvasProps={{
                                width: 300,
                                height: 100,
                                className:
                                  "signature-canvas bg-white cursor-crosshair",
                              }}
                            />
                          </div>
                          <button
                            onClick={() => approverSigPad.current?.clear()}
                            className="text-[10px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
                          >
                            <Trash2 size={10} /> Borrar Firma
                          </button>
                        </div>
                      )}

                      <textarea
                        placeholder="Motivo de la decisión u observaciones..."
                        value={observacion}
                        onChange={(e) => setObservacion(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        rows={3}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() =>
                            setPendingAction({
                              decision: "Rechazado",
                              targetEstado: getRejectionState(actingRole, cometido.estado) as CometidoEstado
                            })
                          }
                          disabled={loading}
                          className="flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 font-bold py-2.5 rounded-xl hover:bg-red-50"
                        >
                          <XCircle size={18} /> Rechazar
                        </button>
                        <button
                          onClick={() =>
                            setPendingAction({
                              decision: "Aprobado",
                              targetEstado: getNextState(actingRole, cometido.estado, cometido.posibleViatico) as CometidoEstado
                            })
                          }
                          disabled={loading}
                          className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100"
                        >
                          <CheckCircle2 size={18} /> 
                          {actingRole === "Personal" ? (cometido.posibleViatico === "No" ? "Finalizar" : "Enviar a Finanzas") : 
                           actingRole === "Finanzas" ? "Registrar Pago" : "Aprobar"}
                        </button>
                      </div>
                      <button
                        onClick={() =>
                          setPendingAction({
                            decision: "Devuelto",
                            targetEstado: getReturnState(actingRole, cometido.estado) as CometidoEstado
                          })
                        }
                        className="w-full flex items-center justify-center gap-2 text-slate-500 font-bold text-xs uppercase p-2 hover:bg-slate-100 rounded-lg mt-2"
                      >
                        <RotateCcw size={14} /> Devolver para corrección
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          ) : (
            /* History Tab */
            <div className="space-y-6">
              {historial.length > 0 ? (
                historial.map((item, idx) => (
                  <div key={item.id} className="flex gap-4 relative">
                    {idx !== historial.length - 1 && (
                      <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-slate-100" />
                    )}
                    <div className="bg-white border-4 border-slate-50 w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10">
                      <Clock size={14} className="text-slate-400" />
                    </div>
                    <div className="flex-1 pb-8">
                      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {item.usuarioNombre}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                              {item.rol}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {getTimelineDate(item.fecha)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                            {item.accion}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-slate-300 line-through">
                              {item.estadoAnterior}
                            </span>
                            <ChevronRight
                              size={10}
                              className="text-slate-300"
                            />
                            <span className="font-bold text-slate-600">
                              {item.estadoNuevo}
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border-l-4 border-slate-200">
                          <p className="text-sm text-slate-600 italic">
                            "{item.observacion}"
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400 italic">
                  No hay historial disponible
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Confirmation Modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full text-center"
          >
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-slate-100 text-slate-600">
               {pendingAction.decision === "Aprobado" ? <CheckCircle2 size={32} className="text-green-600" /> :
                pendingAction.decision === "Rechazado" ? <XCircle size={32} className="text-red-600" /> :
                <AlertTriangle size={32} className="text-amber-600" />
               }
            </div>
            <h3 className="flex flex-col text-xl font-bold text-slate-900 mb-2">
              Confirmar {pendingAction.decision}
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              ¿Está seguro de que desea marcar este cometido como <strong>{pendingAction.decision}</strong>? 
              <br/><br/>
              <span className="text-xs text-slate-400 mt-2 block">
                Nuevo estado: {pendingAction.targetEstado}
              </span>
            </p>

            {actingRole === "Personal" && pendingAction.decision === "Aprobado" && !cometido.resolucionAdministrativa && (
              <div className="mb-6 text-left">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">N° Resolución Administrativa</label>
                  {!resolucionInput && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">GENERACIÓN AUTOMÁTICA</span>}
                </div>
                <input 
                  type="text"
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                  placeholder="Se generará automáticamente (HCXXXXX/2026)"
                  value={resolucionInput}
                  onChange={e => setResolucionInput(e.target.value)}
                />
                {!resolucionInput && <p className="text-[10px] text-slate-400 mt-1.5 px-1">Si deja este campo vacío, el sistema asignará el correlativo HCXXXXX/{new Date().getFullYear()} automáticamente.</p>}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={executePendingAction}
                disabled={loading}
                className={`flex-1 px-4 py-3 text-white rounded-xl font-bold transition-all disabled:opacity-50 ${
                  pendingAction.decision === "Aprobado" ? "bg-blue-600 hover:bg-blue-700" :
                  pendingAction.decision === "Rechazado" ? "bg-red-600 hover:bg-red-700" :
                  "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {loading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <PDFPreviewModal 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
        cometido={cometido} 
        type={previewType}
      />

      {isEditing && (
        <CometidoForm 
          cometidoToEdit={cometido}
          onClose={() => setIsEditing(false)}
          onSuccess={() => {
            setIsEditing(false);
            onUpdate();
            onClose();
          }}
        />
      )}
    </div>
  );
};

const ApprovalItem: React.FC<{
  label: string;
  approved: boolean;
  date?: string | null;
}> = ({ label, approved, date }) => (
  <div className="flex items-center justify-between group">
    <div className="flex items-center gap-3 text-sm">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${approved ? "bg-green-500" : "bg-slate-800"}`}
      >
        {approved ? (
          <CheckCircle2 size={12} />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        )}
      </div>
      <span className={approved ? "text-white" : "text-slate-500"}>
        {label}
      </span>
    </div>
    {date && (
      <span className="text-[10px] font-medium text-slate-500">{date}</span>
    )}
  </div>
);

// Helpers to define state machine
function shouldShowActions(role?: string, state?: CometidoEstado) {
  if (!role || !state) return false;

  // Estados terminales o que requieren acción del funcionario, no de los aprobadores
  const terminalOrReturnedStates = [
    "Pagado",
    "Finalizado",
    "Borrador",
    "No corresponde pago",
    "Devuelto por jefatura",
    "Devuelto por Dirección",
    "Devuelto para corrección",
    "Rechazado por jefatura",
    "Rechazado por Dirección",
    "Rechazado por Personal",
    "Rechazado por Finanzas",
    "Rechazado"
  ];

  if (terminalOrReturnedStates.includes(state)) return false;

  if (role === "Administrador") return true;

  if (
    role === "Jefatura de Servicio" &&
    state === "Pendiente revisión jefatura"
  )
    return true;
  if (role === "Director" && state === "Pendiente revisión Dirección")
    return true;
  if (role === "Personal" && (state === "En revisión por Personal" || state === "Autorizado por Dirección")) return true;
  if (
    role === "Finanzas" &&
    (state === "En revisión por Finanzas" || state === "Pendiente de pago")
  )
    return true;
  return false;
}

function getNextState(role?: string, currentState?: string, posibleViatico?: string): string {
  if (currentState === "Pendiente revisión jefatura")
    return "Pendiente revisión Dirección";
  if (currentState === "Pendiente revisión Dirección")
    return "En revisión por Personal";
  if (currentState === "En revisión por Personal" || currentState === "Autorizado por Dirección") {
    return posibleViatico === "No" ? "No corresponde pago" : "En revisión por Finanzas";
  }
  if (currentState === "En revisión por Finanzas") return "Pagado";
  if (currentState === "Pendiente de pago") return "Pagado";
  return currentState || "Pendiente revisión jefatura";
}

function getRejectionState(role?: string, currentState?: string): string {
  if (currentState === "Pendiente revisión jefatura")
    return "Rechazado por jefatura";
  if (currentState === "Pendiente revisión Dirección")
    return "Rechazado por Dirección";
  if (currentState === "En revisión por Personal")
    return "Rechazado por Personal";
  if (currentState === "En revisión por Finanzas")
    return "Rechazado por Finanzas";
  return "Rechazado";
}

function getReturnState(role?: string, currentState?: string): string {
  if (currentState === "Pendiente revisión jefatura")
    return "Devuelto por jefatura";
  if (currentState === "Pendiente revisión Dirección")
    return "Devuelto por Dirección";
  return "Devuelto para corrección";
}

export default CometidoDetail;
