export const ES2EN: Record<string,string> = {
  lunes:'monday', martes:'tuesday', miercoles:'wednesday', miércoles:'wednesday',
  jueves:'thursday', viernes:'friday', sabado:'saturday', sábado:'saturday', domingo:'sunday'
};
export const EN2ES: Record<string,string> = {
  monday:'lunes', tuesday:'martes', wednesday:'miércoles', thursday:'jueves',
  friday:'viernes', saturday:'sábado', sunday:'domingo'
};
// ES plano (sin tildes) – lo que vamos a enviar al backend
export const EN2ES_PLAIN: Record<string,string> = {
  monday:'lunes', tuesday:'martes', wednesday:'miercoles', thursday:'jueves',
  friday:'viernes', saturday:'sabado', sunday:'domingo'
};

export const WEEKDAYS_EN: string[] = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

export function normDayKey(s: string): string {
  if (!s) return s;
  const k = s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
  return ES2EN[k] ?? k;
}

export function weekdayEnFromDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}
