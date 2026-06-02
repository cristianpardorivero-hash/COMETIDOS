export interface ViaticoValue {
  id: string;
  tramoGrado: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaTermino?: string; // YYYY-MM-DD
  valor100: number; // viatico completo
  valor40: number; // viatico parcial
  createdAt: any;
}

export type Role = 'Funcionario' | 'Jefatura de Servicio' | 'Director' | 'Personal' | 'Finanzas' | 'Administrador';

export interface UserProfile {
  uid: string;
  nombre: string;
  rut: string;
  email: string;
  servicioId: string;
  servicioNombre: string;
  cargo: string;
  grado?: string;
  ley?: string;
  planta?: string;
  genero?: string;
  jefaturaId?: string;
  jefaturaNombre?: string;
  roles: Role[];
  activo: boolean;
  isPending?: boolean;
  createdAt: any;
}

export interface Servicio {
  id: string;
  nombre: string;
  jefaturaUid: string;
  emailJefatura: string;
  activo: boolean;
}

export type CometidoEstado = 
  | 'Borrador'
  | 'Pendiente revisión jefatura'
  | 'Devuelto por jefatura'
  | 'Rechazado por jefatura'
  | 'Aprobado por jefatura'
  | 'Pendiente revisión Dirección'
  | 'Devuelto por Dirección'
  | 'Rechazado por Dirección'
  | 'Autorizado por Dirección'
  | 'En revisión por Personal'
  | 'Rechazado por Personal'
  | 'En revisión por Finanzas'
  | 'Rechazado por Finanzas'
  | 'Pendiente de pago'
  | 'Pagado'
  | 'No corresponde pago'
  | 'Devuelto para corrección'
  | 'Rechazado'
  | 'Finalizado';

export interface CometidoLog {
  id: string;
  cometidoId: string;
  usuarioId: string;
  usuarioNombre: string;
  rol: string;
  accion: 'Creado' | 'Aprobado' | 'Rechazado' | 'Devuelto' | 'Pagado' | 'Finalizado' | 'Corregido';
  estadoAnterior: CometidoEstado;
  estadoNuevo: CometidoEstado;
  observacion?: string;
  fecha: any;
}

export interface Cometido {
  id: string;
  funcionarioUid: string;
  nombreFuncionario: string;
  rut: string;
  email: string;
  servicioId: string;
  servicioNombre: string;
  cargo: string;
  grado?: string;
  ley?: string;
  planta?: string;
  genero?: string;
  tipoCometido: 'Reunión' | 'Traslado' | 'Capacitación' | 'Comisión de servicio' | 'Otro';
  motivo: string;
  destino: string;
  ciudad: string;
  region: string;
  fechaInicio: string;
  horaInicio: string;
  fechaTermino: string;
  horaTermino: string;
  medioTransporte: 'Vehículo institucional' | 'Vehículo particular' | 'Bus' | 'Otro';
  requiereTraslado: boolean;
  fueraDeCurepto: boolean;
  aplicaDistancia: boolean;
  pernoctado: boolean;
  posibleViatico: 'Sí' | 'No' | 'Por evaluar';
  estado: CometidoEstado;
  observacionesFuncionario: string;
  documentosAdjuntos: string[];
  
  // Aprobaciones
  jefaturaUid?: string;
  decisionJefatura?: 'Autorizado' | 'Rechazado' | 'Devuelto';
  fechaDecisionJefatura?: any;
  observacionJefatura?: string;
  
  decisionDirector?: 'Autorizado' | 'Rechazado' | 'Devuelto';
  fechaDecisionDirector?: any;
  observacionDirector?: string;
  
  revisionPersonal?: string;
  fechaRevisionPersonal?: any;
  resolucionAdministrativa?: string;
  observacionPersonal?: string;
  
  correspondeViatico?: boolean;
  montoEstimado?: number;
  montoPagado?: number;
  fechaPago?: string;
  medioPago?: string;
  comprobantePago?: string;
  observacionFinanzas?: string;
  
  // Firmas Digitales
  firmaFuncionario?: string; // base64 image
  selloDigitalFuncionario?: string;
  
  firmaJefatura?: string;    // base64 image
  selloDigitalJefatura?: string;
  nombreJefatura?: string;
  rutJefatura?: string;
  cargoJefatura?: string;

  firmaDirector?: string;    // base64 image
  selloDigitalDirector?: string;
  nombreDirector?: string;
  rutDirector?: string;
  cargoDirector?: string;
  
  createdAt: any;
  updatedAt: any;
}

export type ReemplazoEstado = 
  | 'Borrador'
  | 'Pendiente revisión Dirección'
  | 'Aprobado por Dirección'
  | 'Rechazado por Dirección'
  | 'Recibido por Personal'
  | 'Procesado';

export interface Reemplazo {
  id: string;

  funcionarioReemplazoUid: string;
  nombreFuncionario: string;
  rutFuncionario: string;
  cargoFuncionario: string;
  gradoFuncionario?: string;
  leyFuncionario?: string;
  plantaFuncionario?: string;

  jefaturaUid: string;
  nombreJefatura: string;
  servicioId: string;
  servicioNombre: string;

  motivo: 'Feriado legal' | 'Otro';
  observacionMotivo?: string;

  nombreReemplazante: string;
  rutReemplazante: string;
  profesionReemplazante: string;

  fechaInicio: string;
  fechaTermino: string;

  estado: ReemplazoEstado;

  firmaJefatura?: string;
  selloDigitalJefatura?: string;

  decisionDirector?: 'Autorizado' | 'Rechazado' | 'Devuelto';
  fechaDecisionDirector?: any;
  firmaDirector?: string;
  selloDigitalDirector?: string;
  nombreDirector?: string;
  observacionDirector?: string;

  recepcionadoPersonal?: boolean;
  fechaRecepcionPersonal?: any;
  procesadoPersonal?: boolean;
  fechaProcesadoPersonal?: any;

  createdAt: any;
  updatedAt: any;
}

export interface HistorialCometido {
  id: string;
  cometidoId: string;
  fecha: any;
  usuarioUid: string;
  usuarioNombre: string;
  rol: string;
  accion: string;
  estadoAnterior: string;
  estadoNuevo: string;
  observacion: string;
}

export interface Notificacion {
  id: string;
  usuarioUid: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  link?: string;
  createdAt: any;
}
