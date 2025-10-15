/** Lista de días en español, tal como los espera el backend (lowercase). */
export const DAYS_ES: Array<{ key: string; label: string }> = [
  { key: 'lunes',     label: 'Lunes' },
  { key: 'martes',    label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves',    label: 'Jueves' },
  { key: 'viernes',   label: 'Viernes' },
  { key: 'sabado',    label: 'Sábado' },
  { key: 'domingo',   label: 'Domingo' },
];

/** Genera horas "HH:00" (24h) entre start y end inclusive. */
export function buildHourOptions(start = 6, end = 20): string[] {
  const out: string[] = [];
  for (let h = start; h <= end; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
  }
  return out;
}

/**
 * Convierte fecha (YYYY-MM-DD) y hora ("HH:00") a ISO con offset local,
 * para que el backend derive correctamente el día (locale es-CO).
 */
export function toLocalISO(dateStr: string, hourStr: string): string {
  const [h, m] = hourStr.split(':').map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m ?? 0, 0, 0);

  const tz = -d.getTimezoneOffset();           // minutos
  const sign = tz >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(tz) / 60)).padStart(2, '0');
  const mm = String(Math.abs(tz) % 60).padStart(2, '0');
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${hh}:${mm}`;
}
