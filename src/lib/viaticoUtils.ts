
import { differenceInDays, parseISO } from 'date-fns';

/**
 * Tasas de viáticos nacionales Chile 2024 (Valores referenciales)
 * DSN° 262 de 1977, actualizado por circular del Ministerio de Hacienda.
 */
export const VIATICO_RATES = {
  TIER_1: {
    min: 1,
    max: 5,
    full: 98348,
    partial: 39339, // 40%
  },
  TIER_2: {
    min: 6,
    max: 11,
    full: 68542,
    partial: 27417, // 40%
  },
  TIER_3: {
    min: 12,
    max: 22,
    full: 48435,
    partial: 19374, // 40%
  },
  TIER_4: {
    min: 23,
    max: 26,
    full: 39265,
    partial: 15706, // 40%
  }
};

export function getTierForGrado(grado: string | number | undefined): any {
  if (!grado) return null;
  
  // Extract number from string like "Grado 12" or "12"
  const gradoMatch = String(grado).match(/\d+/);
  if (!gradoMatch) return null;
  
  const gradoNum = parseInt(gradoMatch[0]);
  
  if (gradoNum >= VIATICO_RATES.TIER_1.min && gradoNum <= VIATICO_RATES.TIER_1.max) return VIATICO_RATES.TIER_1;
  if (gradoNum >= VIATICO_RATES.TIER_2.min && gradoNum <= VIATICO_RATES.TIER_2.max) return VIATICO_RATES.TIER_2;
  if (gradoNum >= VIATICO_RATES.TIER_3.min && gradoNum <= VIATICO_RATES.TIER_3.max) return VIATICO_RATES.TIER_3;
  if (gradoNum >= VIATICO_RATES.TIER_4.min && gradoNum <= VIATICO_RATES.TIER_4.max) return VIATICO_RATES.TIER_4;
  
  return null;
}

export function calculateViatico(
  grado: string | number | undefined, 
  startDate: string, 
  endDate: string,
  pernoctado: boolean = false
): { total: number, perDay: number, days: number, tierName: string } {
  const tier = getTierForGrado(grado);
  if (!tier) return { total: 0, perDay: 1, days: 1, tierName: 'No definido' };
  
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  const days = Math.max(1, differenceInDays(end, start) + 1);
  
  // Si es pernoctado, se paga el 100% (full). Si no, se paga el parcial (sin pernoctar).
  const perDay = pernoctado ? tier.full : tier.partial;
  const total = days * perDay;
  
  let tierName = '';
  if (tier === VIATICO_RATES.TIER_1) tierName = 'Tramo I';
  else if (tier === VIATICO_RATES.TIER_2) tierName = 'Tramo II';
  else if (tier === VIATICO_RATES.TIER_3) tierName = 'Tramo III';
  else if (tier === VIATICO_RATES.TIER_4) tierName = 'Tramo IV';
  
  return { total, perDay, days, tierName };
}
