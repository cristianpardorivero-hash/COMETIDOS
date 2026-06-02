import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Cometido } from '../types';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MapPin, User } from 'lucide-react';
import { motion } from 'motion/react';
import CometidoDetail from '../components/CometidoDetail';

export const Calendario: React.FC = () => {
  const { profile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cometidos, setCometidos] = useState<Cometido[]>([]);
  const [selectedCometido, setSelectedCometido] = useState<Cometido | null>(null);
  const [loading, setLoading] = useState(true);

  // Parse ISO date string to timezone-naive Date (just using the year-month-day)
  // because fechaInicio is "YYYY-MM-DD"
  const parseLocalISO = (dateStr: string) => {
    // A simple hack to avoid timezone offset issues is to parse it and add the timezone offset, or just use parts
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const fetchCometidos = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const cometidosRef = collection(db, 'cometidos');
      const userRoles = profile.roles || [];
      const isManager = userRoles.includes('Administrador') || userRoles.includes('Director') || userRoles.includes('Personal') || userRoles.includes('Finanzas');
      const isJefatura = userRoles.includes('Jefatura de Servicio');

      let q;
      if (isManager) {
        q = query(cometidosRef, orderBy('fechaInicio', 'asc'));
      } else if (isJefatura) {
        q = query(cometidosRef, where('servicioId', '==', profile.servicioId), orderBy('fechaInicio', 'asc'));
      } else {
        q = query(cometidosRef, where('funcionarioUid', '==', profile.uid), orderBy('fechaInicio', 'asc'));
      }

      const querySnapshot = await getDocs(q);
      const fetchedCometidos: Cometido[] = [];
      querySnapshot.forEach((doc) => {
        fetchedCometidos.push({ id: doc.id, ...doc.data() } as Cometido);
      });
      
      const validCometidos = fetchedCometidos.filter(c => 
        !['Borrador', 'Rechazado por jefatura', 'Rechazado por Dirección', 'Rechazado por Personal', 'Rechazado por Finanzas'].includes(c.estado)
      );

      setCometidos(validCometidos);
    } catch (error) {
      console.error('Error al cargar cometidos para el calendario:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCometidos();
  }, [profile]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 capitalize flex items-center gap-2">
          <CalendarIcon className="text-blue-600" />
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className="flex space-x-2">
          <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronRight size={24} className="text-gray-600" />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth, { weekStartsOn: 1 });
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-semibold text-gray-500 text-sm py-2">
          {format(addDays(startDate, i), 'EEEE', { locale: es }).substring(0, 3).toUpperCase()}
        </div>
      );
    }
    return <div className="grid grid-cols-7 mb-2">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;

        // Find cometidos for this day
        // A cometido spans from fechaInicio to fechaTermino
        const dayCometidos = cometidos.filter(c => {
          if (!c.fechaInicio) return false;
          const start = parseLocalISO(c.fechaInicio);
          const end = c.fechaTermino ? parseLocalISO(c.fechaTermino) : start;
          // day should be between start and end inclusive
          // set time to 0 to properly compare
          start.setHours(0,0,0,0);
          end.setHours(23,59,59,999);
          return cloneDay >= start && cloneDay <= end;
        });

        days.push(
          <div
            key={day.toISOString()}
            className={`min-h-[120px] p-2 border border-gray-100 relative ${
              !isSameMonth(day, monthStart)
                ? 'bg-gray-50 text-gray-400'
                : 'bg-white text-gray-800'
            } ${isSameDay(day, new Date()) ? 'bg-blue-50/30' : ''}`}
          >
            <div className={`flex justify-end`}>
              <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                isSameDay(day, new Date()) ? 'bg-blue-600 text-white' : ''
              }`}>
                {formattedDate}
              </span>
            </div>
            
            <div className="mt-1 flex flex-col gap-1 overflow-y-auto max-h-[80px]">
              {dayCometidos.map(cometido => {
                const isApproved = ['Aprobado por jefatura', 'Autorizado por Dirección', 'En revisión por Personal', 'En revisión por Finanzas', 'Pendiente de pago', 'Pagado'].includes(cometido.estado);
                return (
                  <div 
                    key={cometido.id} 
                    onClick={() => setSelectedCometido(cometido)}
                    className={`text-xs p-1.5 rounded-md truncate border cursor-pointer hover:shadow-md transition-shadow ${
                      isApproved ? 'bg-green-50 border-green-200 text-green-800' : 'bg-orange-50 border-orange-200 text-orange-800'
                    }`}
                    title={`${cometido.nombreFuncionario} - ${cometido.destino} (${cometido.estado})`}
                  >
                    <div className="font-semibold truncate">{cometido.nombreFuncionario.split(' ')[0]} {cometido.nombreFuncionario.split(' ')[1] || ''}</div>
                    <div className="flex items-center gap-1 opacity-80 truncate mt-0.5">
                      <MapPin size={10} className="shrink-0" />
                      <span className="truncate">{cometido.destino}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toISOString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="bg-white border-t border-l border-gray-200 shadow-sm rounded-xl overflow-hidden">{rows}</div>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto"
    >
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Calendario Institucional</h1>
            <p className="text-gray-500 mt-1">
              Vista de programación de cometidos 
              {profile?.roles?.includes('Director') || profile?.roles?.includes('Administrador') ? ' a nivel institucional' : 
               profile?.roles?.includes('Jefatura de Servicio') ? ' de su servicio' : ' personales'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-orange-200 border border-orange-300"></div>
              <span className="text-gray-600">En Trámite</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-200 border border-green-300"></div>
              <span className="text-gray-600">Aprobados</span>
            </div>
          </div>
        </div>

        <div className="calendar-container">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>
      </div>

      {selectedCometido && (
        <CometidoDetail 
          cometido={selectedCometido} 
          onClose={() => setSelectedCometido(null)} 
          onUpdate={fetchCometidos}
        />
      )}
    </motion.div>
  );
};
