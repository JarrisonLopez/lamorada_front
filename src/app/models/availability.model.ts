// Tipos compartidos para disponibilidad
export type AvSlot = { start: string; end: string };

export type AvailabilityDoc = {
  _id?: string;
  days: string[];      // 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
  slots: AvSlot[];
};
