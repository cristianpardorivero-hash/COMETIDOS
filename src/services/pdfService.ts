import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatDate } from "../lib/dateUtils";
import { Cometido, Reemplazo } from "../types";
import QRCode from 'qrcode';

export const generateReemplazoPDF = async (reemplazo: Reemplazo) => {
  const doc = new jsPDF();
  const margin = 20;
  let y = 25;

  const addSectionTitle = (title: string, yPos: number) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 5, 170, 7, "F");
    doc.text(title, margin + 2, yPos);
    return yPos + 10;
  };

  const addField = (label: string, value: string | number | undefined, yPos: number, xPos = margin) => {
    if (value === undefined || value === null) return yPos;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(`${label}:`, xPos, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(String(value), xPos + 45, yPos);
    return yPos + 7;
  };

  // Header
  doc.setFontSize(16);
  doc.setTextColor(0, 51, 102);
  doc.setFont("helvetica", "bold");
  doc.text("HOSPITAL DE CUREPTO", margin, y);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Unidad de Recursos Humanos - Gestión de Personal", margin, y + 6);
  
  // Solicitud Number & Date
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`SOLICITUD DE REEMPLAZO #${reemplazo.id.substring(0, 8).toUpperCase()}`, 115, y);
  doc.setFontSize(8);
  const dateStr = reemplazo.createdAt?.toDate ? format(reemplazo.createdAt.toDate(), "dd/MM/yyyy HH:mm") : "N/A";
  doc.text(`Fecha Solicitud: ${dateStr}`, 115, y + 6);
  
  y += 20;

  // Section: Datos del Funcionario a Reemplazar
  y = addSectionTitle("DATOS DEL FUNCIONARIO A REEMPLAZAR", y);
  y = addField("Nombre Completo", reemplazo.nombreFuncionario, y);
  y = addField("Servicio / Unidad", reemplazo.servicioNombre, y);
  y = addField("Motivo Reemplazo", reemplazo.motivo, y);
  if (reemplazo.observacionMotivo) {
    y = addField("Detalle Motivo", reemplazo.observacionMotivo, y);
  }
  
  y += 5;

  // Section: Datos del Reemplazante
  y = addSectionTitle("DATOS DEL REEMPLAZANTE", y);
  y = addField("Nombre Reemplazante", reemplazo.nombreReemplazante, y);
  y = addField("RUT Reemplazante", reemplazo.rutReemplazante, y);
  
  y += 5;

  // Section: Periodo del Reemplazo
  y = addSectionTitle("PERIODO DEL REEMPLAZO", y);
  y = addField("Fecha Inicio", formatDate(reemplazo.fechaInicio), y);
  y = addField("Fecha Término", formatDate(reemplazo.fechaTermino), y);
  
  y += 5;

  // Section: Estado y Validación
  y = addSectionTitle("ESTADO Y VALIDACIÓN", y);
  y = addField("Estado Actual", reemplazo.estado, y);
  if (reemplazo.observacionDirector) {
    y += 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Observación Dirección:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const splitText = doc.splitTextToSize(reemplazo.observacionDirector, 160);
    doc.text(splitText, margin + 5, y);
    y += (splitText.length * 5);
  }

  y += 20;

  // Footer / Signatures
  const pageHeight = doc.internal.pageSize.height;
  y = pageHeight - 75;
  
  // 1. Jefatura (Left)
  if (reemplazo.firmaJefatura) {
    try {
      doc.addImage(reemplazo.firmaJefatura, 'PNG', margin, y - 25, 50, 20);
    } catch (e) {
      console.error("Error adding jefatura signature:", e);
    }
  }

  // 2. Dirección (Right)
  if (reemplazo.firmaDirector) {
    try {
      doc.addImage(reemplazo.firmaDirector, 'PNG', 130, y - 25, 50, 20);
    } catch (e) {
      console.error("Error adding director signature:", e);
    }
  }

  // Draw lines
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + 50, y);
  doc.line(130, y, 180, y);
  
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  
  // Labels Jefatura
  doc.setFont("helvetica", "bold");
  doc.text("FIRMA JEFATURA SOLICITANTE", margin, y + 5);
  if (reemplazo.selloDigitalJefatura) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(`Sello: ${reemplazo.selloDigitalJefatura}`, margin, y + 9);
  }

  // Labels Dirección
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FIRMA / SELLO DIRECCIÓN", 130, y + 5);
  if (reemplazo.selloDigitalDirector) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(`Sello: ${reemplazo.selloDigitalDirector}`, 130, y + 9);
  }

  // QR Code
  const qrY = y + 20;
  try {
    const qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/verify/${reemplazo.id}`);
    doc.addImage(qrDataUrl, 'PNG', margin, qrY, 20, 20);
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text("Verificación de Autenticidad", margin + 22, qrY + 8);
    doc.text(`ID: ${reemplazo.id}`, margin + 22, qrY + 12);
  } catch (err) {
    console.error("Error adding QR:", err);
  }

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Este documento es una copia digital de la solicitud de reemplazo tramitada a través del Sistema de Gestión de Hospital Curepto.", margin, pageHeight - 15);
  doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`, 150, pageHeight - 15);

  return doc;
};

export const generateCometidoPDF = async (cometido: Cometido) => {
  const doc = new jsPDF();
  const margin = 20;
  let y = 25;

  const addSectionTitle = (title: string, yPos: number) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 5, 170, 7, "F");
    doc.text(title, margin + 2, yPos);
    return yPos + 10;
  };

  const addField = (label: string, value: string | number | undefined, yPos: number, xPos = margin) => {
    if (value === undefined || value === null) return yPos;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(`${label}:`, xPos, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(String(value), xPos + 45, yPos);
    return yPos + 7;
  };

  // Header
  doc.setFontSize(16);
  doc.setTextColor(0, 51, 102);
  doc.setFont("helvetica", "bold");
  doc.text("HOSPITAL DE CUREPTO", margin, y);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Unidad de Recursos Humanos y Finanzas", margin, y + 6);
  
  // Solicitud Number & Date
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`SOLICITUD DE COMETIDO #${cometido.id.substring(0, 8).toUpperCase()}`, 115, y);
  doc.setFontSize(8);
  const dateStr = cometido.createdAt?.toDate ? format(cometido.createdAt.toDate(), "dd/MM/yyyy HH:mm") : "N/A";
  doc.text(`Fecha Solicitud: ${dateStr}`, 115, y + 6);
  
  y += 20;

  // Section: Datos del Funcionario
  y = addSectionTitle("DATOS DEL FUNCIONARIO", y);
  y = addField("Nombre Completo", cometido.nombreFuncionario, y);
  y = addField("RUT", cometido.rut, y);
  y = addField("Género", cometido.genero, y);
  y = addField("Cargo", cometido.cargo, y);
  y = addField("Grado / Planta", (cometido.grado || cometido.planta) ? `${cometido.grado || 'S/G'} - ${cometido.planta || 'S/P'}` : undefined, y);
  y = addField("Ley", cometido.ley, y);
  y = addField("Servicio / Unidad", cometido.servicioNombre, y);
  
  y += 5;

  // Section: Detalles del Cometido
  y = addSectionTitle("DETALLES DEL COMETIDO", y);
  y = addField("Tipo de Cometido", cometido.tipoCometido, y);
  y = addField("Motivo", cometido.motivo, y);
  y = addField("Destino Principal", `${cometido.destino}, ${cometido.ciudad} (${cometido.region})`, y);
  y = addField("Fuera de Curepto", cometido.fueraDeCurepto ? "Sí" : "No", y);
  y = addField("Fecha Inicio", `${formatDate(cometido.fechaInicio)} ${cometido.horaInicio} hrs`, y);
  y = addField("Fecha Término", `${formatDate(cometido.fechaTermino)} ${cometido.horaTermino} hrs`, y);

  y += 5;

  // Section: Logística y Viático
  y = addSectionTitle("LOGÍSTICA Y VIÁTICO", y);
  y = addField("Medio de Transporte", cometido.medioTransporte, y);
  y = addField("Vehículo Inst.", cometido.requiereTraslado ? "Requiere traslado institucional" : "No requiere traslado", y);
  y = addField("Derecho a Viático", cometido.posibleViatico, y);
  if (cometido.observacionesFuncionario) {
    y += 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Observaciones:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const splitText = doc.splitTextToSize(cometido.observacionesFuncionario || '', 160);
    doc.text(splitText, margin + 5, y);
    y += (splitText.length * 5);
  }

  y += 5;

  // Section: Estado y Resoluciones (if applicable)
  y = addSectionTitle("ESTADO ADMINISTRATIVO", y);
  y = addField("Estado Actual", cometido.estado, y);
  if (cometido.resolucionAdministrativa) {
    y = addField("N° Resolución", cometido.resolucionAdministrativa, y);
  }
  
  if (cometido.montoPagado && cometido.montoPagado > 0) {
    y = addField("Monto Pagado", `$${cometido.montoPagado.toLocaleString("es-CL")}`, y);
    y = addField("Fecha de Pago", cometido.fechaPago, y);
    y = addField("Medio de Pago", cometido.medioPago, y);
  }

  y += 20;

  // Footer / Signatures
  const pageHeight = doc.internal.pageSize.height;
  y = pageHeight - 75;
  
  // Signature Spots: 
  // 1. Funcionario (Left: margin to margin + 50)
  // 2. Jefatura (Middle: 80 to 130)
  // 3. Dirección (Right: 140 to 190)

  // 1. Funcionario
  if (cometido.firmaFuncionario) {
    try {
      doc.addImage(cometido.firmaFuncionario, 'PNG', margin, y - 25, 50, 20);
    } catch (e) {
      console.error("Error adding funcionario signature:", e);
    }
  }

  // 2. Jefatura
  if (cometido.firmaJefatura) {
    try {
      doc.addImage(cometido.firmaJefatura, 'PNG', 80, y - 25, 50, 20);
    } catch (e) {
      console.error("Error adding jefatura signature:", e);
    }
  }

  // 3. Dirección
  if (cometido.firmaDirector) {
    try {
      doc.addImage(cometido.firmaDirector, 'PNG', 140, y - 25, 50, 20);
    } catch (e) {
      console.error("Error adding director signature:", e);
    }
  }

  // Draw lines
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + 50, y);
  doc.line(80, y, 130, y);
  doc.line(140, y, 190, y);
  
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  
  // Labels Funcionario
  doc.setFont("helvetica", "bold");
  doc.text(cometido.nombreFuncionario.toUpperCase(), margin, y + 5);
  doc.setFont("helvetica", "normal");
  doc.text(`RUT: ${cometido.rut}`, margin, y + 9);
  doc.text(cometido.cargo, margin, y + 13);
  doc.setFont("helvetica", "bold");
  doc.text("FIRMA FUNCIONARIO", margin, y + 18);

  // Labels Jefatura
  if (cometido.nombreJefatura) {
    doc.setFont("helvetica", "bold");
    doc.text(cometido.nombreJefatura.toUpperCase(), 80, y + 5, { maxWidth: 50 });
    doc.setFont("helvetica", "normal");
    doc.text(`RUT: ${cometido.rutJefatura}`, 80, y + 13);
    doc.setFont("helvetica", "bold");
    doc.text("FIRMA JEFATURA", 80, y + 18);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("Pendiente Jefatura", 80, y + 5);
    doc.setTextColor(0, 0, 0);
  }

  // Labels Dirección
  if (cometido.nombreDirector) {
    doc.setFont("helvetica", "bold");
    doc.text(cometido.nombreDirector.toUpperCase(), 140, y + 5, { maxWidth: 50 });
    doc.setFont("helvetica", "normal");
    doc.text(`RUT: ${cometido.rutDirector}`, 140, y + 13);
    doc.setFont("helvetica", "bold");
    doc.text("FIRMA DIRECCIÓN", 140, y + 18);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("Pendiente Dirección", 140, y + 5);
    doc.setTextColor(0, 0, 0);
  }

  // QR Codes and verification info at the very bottom
  const qrY = y + 25;
  try {
    const qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/verify/${cometido.id}`);
    doc.addImage(qrDataUrl, 'PNG', margin, qrY, 20, 20);
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text("Escanee para verificar autenticidad", margin + 22, qrY + 8);
    doc.text(`ID: ${cometido.id}`, margin + 22, qrY + 12);
  } catch (err) {
    console.error("Error adding global QR:", err);
  }

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Este documento es una copia digital de la solicitud de cometido tramitada a través del Sistema de Gestión de Hospital Curepto.", margin, pageHeight - 15);
  doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`, 150, pageHeight - 15);

  return doc;
};

export const generateResolucionPDF = async (cometido: Cometido) => {
  const doc = new jsPDF();
  const margin = 25;
  let y = 30;

  // Header Left - Institution
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICIO DE SALUD MAULE", margin, y);
  doc.text("HOSPITAL DE CUREPTO", margin, y + 5);
  doc.setFont("helvetica", "normal");
  doc.text("Dirección", margin, y + 10);

  // Header Right - Resolution Number
  const resNumber = cometido.resolucionAdministrativa || "_____";
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`RESOLUCIÓN EXENTA N° ${resNumber}`, 115, y + 5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  // Use revision date if available, otherwise current date
  const revDate = cometido.fechaRevisionPersonal?.toDate?.() || new Date();
  const dateStr = format(revDate, "dd/MM/yyyy", { locale: es });
  doc.text(`CUREPTO, ${dateStr}`, 115, y + 12);

  y += 35;

  // Title
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("VISTOS:", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const vistos = [
    "D.F.L. N° 1/05 que fija el texto refundido, coordinado y sistematizado del D.L. N° 2763/79 y de las Leyes N° 18.933 y N° 18.469.",
    "Reglamento de Viáticos para el personal de los Servicios de Salud, aprobado por el Decreto N° 262 de 1977, del Ministerio de Hacienda y sus modificaciones posteriores.",
    "Ley N° 18.834 sobre Estatuto Administrativo, cuyo texto refundido fue fijado por el D.F.L. N° 29 de 2005 del Ministerio de Hacienda.",
    "Resolución N° 6 y 7 de 2019 de la Contraloría General de la República, que fija normas sobre exención del trámite de toma de razón.",
    "Resoluciones exentas que delegan facultades en el Director del Hospital de Curepto.",
    "Solicitud Director del Establecimiento.",
    "La Resolución N° 1600/08.",
    "Resolución Nº 10/2017 de la Contraloría General de la República.",
    "Lo dispuesto en el Art. 46° del DS. 140/2004.",
    "Articulo N° 46 del Reglamento Orgánico de Servicios de Salud.",
    "Lo previsto en la Resolución Nº 36/2024 de la Contraloría General de la República, que fija normas sobre exención del trámite de toma de razón.",
    "Resolución Exenta Nº 2480/2012.",
    "Resolución Exenta N° 3256/2021, ambas del Servicio de Salud Maule.",
    `Solicitud de Cometido de Servicio N° ${cometido.id.substring(0, 8).toUpperCase()}, de fecha ${cometido.createdAt?.toDate ? format(cometido.createdAt.toDate(), "dd/MM/yyyy") : ''}.`
  ];

  vistos.forEach(text => {
    const fullText = `- ${text}`;
    doc.text(fullText, margin + 5, y, { align: "justify", maxWidth: 160 });
    const splitVistos = doc.splitTextToSize(fullText, 160);
    y += (splitVistos.length * 4.5);
  });

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text("dicto la siguiente", margin, y);

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("CONSIDERANDO:", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const considerandoStr = `Que, por estrictas necesidades de servicio y con el fin de asegurar el cumplimiento de las funciones institucionales encomendadas a este establecimiento de salud, se requiere que el funcionario(a) don(ña) ${cometido.nombreFuncionario}, RUT ${cometido.rut}, de la dotación del Hospital de Curepto, cumpla funciones fuera de su residencia habitual para realizar: "${cometido.motivo}".`;
  doc.text(considerandoStr, margin + 5, y, { align: "justify", maxWidth: 155 });
  const splitConsiderando = doc.splitTextToSize(considerandoStr, 155);
  y += (splitConsiderando.length * 5) + 6;

  doc.setFont("helvetica", "bold");
  doc.text("RESUELVO:", margin, y);
  y += 8;

  // Resoluciones
  const resoluciones = [
    `1.- ORDÉNASE COMETIDO DE SERVICIO al funcionario(a) don(ña) ${cometido.nombreFuncionario.toUpperCase()}, RUT ${cometido.rut}, grado ${cometido.grado || '(sin grado)'} de la planta ${cometido.planta || '(sin planta)'}, ley ${cometido.ley || '(sin ley)'}, quien desempeña el cargo de ${cometido.cargo} en el servicio de ${cometido.servicioNombre}.`,
    `2.- EL COMETIDO SE REALIZARÁ en la localidad de ${cometido.ciudad}, ${cometido.region}, específicamente en ${cometido.destino}, durante el periodo comprendido desde el ${formatDate(cometido.fechaInicio)} hasta el ${formatDate(cometido.fechaTermino)}, ambas fechas inclusive.`,
    `3.- EL DESPLAZAMIENTO se efectuará preferentemente en ${cometido.medioTransporte.toLowerCase()}${cometido.requiereTraslado ? ", autorizándose el uso de vehículo institucional si estuviere disponible" : ""}.`,
    `4.- EL REFERIDO COMETIDO ${cometido.posibleViatico === "Sí" ? "DA" : "NO DA"} DERECHO AL PAGO DE VIÁTICO reglamentario por los días que corresponda conforme a la normativa vigente, con cargo al presupuesto institucional del presente año.`,
    `5.- PROCÉDASE al pago de pasajes y otros gastos derivados del traslado si correspondiere, previa rendición de cuentas según las formalidades legales.`
  ];

  doc.setFont("helvetica", "normal");
  resoluciones.forEach(text => {
    doc.text(text, margin + 5, y, { align: "justify", maxWidth: 155 });
    const splitRes = doc.splitTextToSize(text, 155);
    y += (splitRes.length * 5) + 3;
  });

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("ANÓTESE, COMUNÍQUESE Y ARCHÍVESE", margin + 5, y);

  y += 20;

  // Signatures
  const authName = cometido.nombreDirector || cometido.nombreJefatura || "DIRECTOR(A)";
  const authRut = cometido.rutDirector || cometido.rutJefatura || "";
  const authCargo = cometido.cargoDirector || cometido.cargoJefatura || "Hospital de Curepto";
  const authoritySignature = cometido.firmaDirector || cometido.firmaJefatura;

  if (authoritySignature) {
    try {
      doc.addImage(authoritySignature, 'PNG', 130, y - 15, 50, 15);
    } catch (e) {
      console.error("Error adding authority signature to Resolution PDF:", e);
    }
  }

  doc.setLineWidth(0.5);
  doc.line(120, y + 5, 190, y + 5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(authName.toUpperCase(), 155, y + 10, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`RUT: ${authRut}`, 155, y + 14, { align: "center" });
  doc.text(authCargo, 155, y + 18, { align: "center" });
  doc.text("HOSPITAL DE CUREPTO", 155, y + 22, { align: "center" });

  // Distribution List
  y += 35;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("DISTRIBUCIÓN:", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  const distribucion = [
    "Funcionario Interesado",
    "Unidad de Recursos Humanos",
    "Sección Finanzas",
    "Servicio / Unidad de Origen",
    "Oficina de Partes",
    "Archivo"
  ];

  distribucion.forEach((item, idx) => {
    doc.text(`- ${item}`, margin + 5, y + (idx * 3.5));
  });

  // Verification
  y = doc.internal.pageSize.height - 40;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const seal = cometido.selloDigitalDirector || cometido.selloDigitalJefatura || "AUTH_VERIFIED_INTERNAL";
  doc.text(`CÓDIGO VERIFICACIÓN: ${seal}`, margin, y);
  
  try {
    const qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/verify/${cometido.id}`);
    doc.addImage(qrDataUrl, 'PNG', margin, y + 3, 20, 20);
  } catch (error) {
    console.error("QR Error in Resolution:", error);
  }

  doc.text("Documento electrónico validado institucionalmente.", margin + 25, y + 10);
  doc.text(`ID Cometido: ${cometido.id}`, margin + 25, y + 15);

  return doc;
};
