// src/app/core/utils/time.ts
export function generateTimeSlots(start: string, end: string, stepMin = 30): string[] {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let cur = sh * 60 + sm;
  const to = eh * 60 + em;
  const out: string[] = [];
  while (cur + stepMin <= to) {
    const h = String(Math.floor(cur / 60)).padStart(2,'0');
    const m = String(cur % 60).padStart(2,'0');
    out.push(`${h}:${m}`);
    cur += stepMin;
  }
  return out;
}
export function weekdayEs(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][d.getDay()];
}
