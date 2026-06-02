import { addDays, isWeekend, isSameDay, parseISO, eachDayOfInterval } from 'date-fns';

// Helper to check if a date is a Chilean holiday
// Note: This is a simplified list of fixed holidays for Chile. 
// For a production app, this should ideally be fetched from an API or a more exhaustive list.
const getChileanHolidays = (year: number): Date[] => {
  const holidays = [
    `${year}-01-01`, // Año Nuevo
    `${year}-05-01`, // Día del Trabajo
    `${year}-05-21`, // Glorias Navales
    `${year}-06-29`, // San Pedro y San Pablo (approx)
    `${year}-07-16`, // Virgen del Carmen
    `${year}-08-15`, // Asunción de la Virgen
    `${year}-09-18`, // Fiestas Patrias
    `${year}-09-19`, // Glorias del Ejército
    `${year}-10-12`, // Encuentro de Dos Mundos
    `${year}-10-31`, // Día de las Iglesias Evangélicas y Protestantes
    `${year}-11-01`, // Todos los Santos
    `${year}-12-08`, // Inmaculada Concepción
    `${year}-12-25`, // Navidad
  ].map(dateStr => parseISO(dateStr));

  return holidays;
};

export const calculateBusinessDaysChile = (startDateStr: string, endDateStr: string): number => {
  if (!startDateStr || !endDateStr) return 0;
  
  try {
    const start = parseISO(startDateStr);
    const end = parseISO(endDateStr);
    
    if (start > end) return 0;
    
    const days = eachDayOfInterval({ start, end });
    const holidays = getChileanHolidays(start.getFullYear());
    // Also check for holidays in the next year if interval spans across years
    if (end.getFullYear() !== start.getFullYear()) {
      holidays.push(...getChileanHolidays(end.getFullYear()));
    }
    
    let businessDaysCount = 0;
    
    for (const day of days) {
      const isHoliday = holidays.some(h => isSameDay(h, day));
      if (!isWeekend(day) && !isHoliday) {
        businessDaysCount++;
      }
    }
    
    return businessDaysCount;
  } catch (error) {
    console.error("Error calculating business days:", error);
    return 0;
  }
};
