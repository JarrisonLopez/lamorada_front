export type Appointment = {
  _id?: string;
  patient_id: string;
  psychologist_id: string;
  day: string;        // monday, tuesday, ...
  start: string;      // "HH:00" o ISO según respuesta
  end: string;        // "HH:00"
  status: "pendiente" | "confirmada" | "completada" | "cancelada";
  createdAt?: string;
  updatedAt?: string;
};
