import { Component, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgIf, NgFor, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AppointmentService } from '../../services/appointment.service';
import { AvailabilityService } from '../../services/availability.service';
import { AvSlot, AvailabilityDoc } from '../../models/availability.model';

type Role = 'patient' | 'psychologist' | 'unknown';

interface UserLite {
  _id: string;
  name?: string;
  email?: string;
}

interface AppointmentRow {
  _id: string;
  patient_id: string;
  psychologist_id: string;
  day: string;
  start: string;
  end: string;
  status: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
  createdAt?: string;
  updatedAt?: string;
}

type AppForm = FormGroup<{
  date: FormControl<string>;
  hour: FormControl<string>;
  psychologist_id: FormControl<string>;
  patient_id: FormControl<string | null>;
}>;

const HOURS_FALLBACK = [
  '08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00'
];

@Component({
  standalone: true,
  selector: 'app-appointment',
  imports: [CommonModule, ReactiveFormsModule, NgIf, NgFor],
  templateUrl: './appointment.component.html',
  styleUrls: ['./appointment.component.css'],
})
export class AppointmentComponent {
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private apSrv: AppointmentService,
    private avSrv: AvailabilityService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.form = this.fb.group({
      date: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
      hour: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)] }),
      psychologist_id: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
      patient_id: this.fb.control<string | null>(null),
    });
  }

  form!: AppForm;
  loading = true;
  creating = false;
  listing = false;
  role: Role = 'unknown';
  userId: string | null = null;
  public minDate: string | null = null;

  psychologists: UserLite[] = [];
  patients: UserLite[] = [];
  appointments: AppointmentRow[] = [];
  hours: string[] = [];
  myAvailability: AvailabilityDoc | null = null;

  public isBrowser() { return isPlatformBrowser(this.platformId); }

  private headers(): HttpHeaders {
    let t: string | null = null;
    if (this.isBrowser()) { try { t = localStorage.getItem('token'); } catch {} }
    return new HttpHeaders({ 'Content-Type': 'application/json', Authorization: t ? `Bearer ${t}` : '' });
  }

  private decodeToken(): any | null {
    if (!this.isBrowser()) return null;
    try {
      const t = localStorage.getItem('token');
      if (!t) return null;
      const payload = t.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch { return null; }
  }

  ngOnInit() {
    if (!this.isBrowser()) { this.loading = false; return; }

    const now = new Date();
    this.minDate = [
      now.getFullYear(),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getDate().toString().padStart(2, '0'),
    ].join('-');

    const claims = this.decodeToken();
    const roleRaw = (claims?.role || claims?.user?.role || '').toString();
    this.role = (roleRaw === 'patient' || roleRaw === 'psychologist') ? roleRaw : 'unknown';
    this.userId = (claims?.user_id || claims?._id || claims?.sub || claims?.id || claims?.user?._id || null)?.toString() ?? null;

    Promise.all([
      this.fetchPsychologists(),
      this.role === 'psychologist' ? this.fetchPatients() : Promise.resolve(),
      this.role === 'psychologist' ? this.fetchMyAvailability() : Promise.resolve(),
    ]).finally(() => {
      this.loading = false;
      this.refreshList(); // primer pintado
    });

    this.form.controls.date.valueChanges.subscribe(() => this.regenerateHours());
    this.form.controls.psychologist_id.valueChanges.subscribe(() => this.regenerateHours());
  }

  private extractUsers(resp: any): any[] {
    if (!resp) return [];
    if (Array.isArray(resp)) return resp;
    if (Array.isArray(resp.users)) return resp.users;
    if (Array.isArray(resp.data)) return resp.data;
    if (Array.isArray(resp.items)) return resp.items;
    const direct = Object.values(resp).find(v => Array.isArray(v)) as any[] | undefined;
    if (direct) return direct;
    return [];
  }

  private hydrateUsers(arr: any[] | null | undefined): UserLite[] {
    return (arr ?? [])
      .map((u: any) => ({
        _id: String(u?._id ?? u?.id ?? u?.user_id ?? ''),
        name: u?.name ?? u?.fullName ?? u?.email ?? u?.username,
        email: u?.email,
      }))
      .filter(u => !!u._id);
  }

  private fetchPsychologists(): Promise<void> {
    return new Promise((resolve) => {
      const url = 'https://la-morada-back-production.up.railway.app/user/get-psychologists';
      this.http.get<any>(url, { headers: this.headers() })
        .subscribe({ next: (r) => { this.psychologists = this.hydrateUsers(this.extractUsers(r)); }, error: () => { this.psychologists = []; }, complete: () => resolve() });
    });
  }

  private fetchPatients(): Promise<void> {
    return new Promise((resolve) => {
      const url = 'https://la-morada-back-production.up.railway.app/user/get-patients';
      this.http.get<any>(url, { headers: this.headers() })
        .subscribe({ next: (r) => { this.patients = this.hydrateUsers(this.extractUsers(r)); }, error: () => { this.patients = []; }, complete: () => resolve() });
    });
  }

  private fetchMyAvailability(): Promise<void> {
    return new Promise((resolve) => {
      this.avSrv.getAvailability().subscribe({
        next: (doc) => { this.myAvailability = doc ?? null; },
        error: () => { this.myAvailability = null; },
        complete: () => resolve(),
      });
    });
  }

  public refreshList() {
    this.listing = true;
    this.cdr.markForCheck();

    const sub = this.apSrv.getAll()
      .subscribe({
        next: (r: any) => {
          try {
            const arr = (Array.isArray(r) ? r : (r?.appointments || r?.data || [])) as AppointmentRow[];
            this.appointments = (arr || []).slice().sort((a, b) => {
              const ka = `${a.day}-${a.start}`;
              const kb = `${b.day}-${b.start}`;
              return ka.localeCompare(kb);
            });
          } catch {
            this.appointments = [];
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.appointments = [];
          this.cdr.detectChanges();
        }
      });

    // -> garantizamos apagar el spinner SIEMPRE
    sub.add(() => {
      this.listing = false;
      this.cdr.detectChanges();
    });
  }

  private weekdayEsPlain(yyyy_mm_dd: string): string | null {
    if (!yyyy_mm_dd) return null;
    try {
      const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
      const dt = new Date(y, (m - 1), d, 12, 0, 0);
      const name = dt.toLocaleDateString('es-CO', { weekday: 'long' }).toLowerCase();
      return name.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    } catch { return null; }
  }

  private hoursFromSlots(slots: AvSlot[]): string[] {
    const out: string[] = [];
    for (const slot of slots) {
      const sh = Number(slot.start.slice(0, 2));
      const eh = Number(slot.end.slice(0, 2));
      for (let h = sh; h < eh; h++) {
        const start = `${h.toString().padStart(2,'0')}:00`;
        const endH = `${(h + 1).toString().padStart(2,'0')}:00`;
        if (endH <= slot.end) out.push(start);
      }
    }
    return out;
  }

  private filterPastHoursForToday(hours: string[], yyyy_mm_dd: string): string[] {
    try {
      const today = new Date();
      const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
      const sel = new Date(y, m - 1, d);
      if (sel.toDateString() !== today.toDateString()) return hours;
      const currentHour = today.getHours();
      return hours.filter(h => Number(h.slice(0,2)) > currentHour);
    } catch { return hours; }
  }

  public regenerateHours() {
    const date = this.form.controls.date.value;

    if (this.role === 'psychologist' && this.myAvailability) {
      const w = this.weekdayEsPlain(date);
      const allowed = (this.myAvailability.days || []).map((x: string) => String(x).toLowerCase());
      if (!w || !allowed.includes(w)) {
        this.hours = [];
        this.form.controls.hour.setValue('');
        return;
      }
      let hours = this.hoursFromSlots(this.myAvailability.slots || []);
      hours = this.filterPastHoursForToday(hours, date);
      this.hours = hours;
      if (this.hours.length && !this.hours.includes(this.form.controls.hour.value)) {
        this.form.controls.hour.setValue(this.hours[0]);
      } else if (!this.hours.length) {
        this.form.controls.hour.setValue('');
      }
      return;
    }

    const h = this.filterPastHoursForToday([...HOURS_FALLBACK], date);
    this.hours = h;
    if (this.hours.length && !this.hours.includes(this.form.controls.hour.value)) {
      this.form.controls.hour.setValue(this.hours[0]);
    } else if (!this.hours.length) {
      this.form.controls.hour.setValue('');
    }
  }

  // UTC fijo para conservar la hora elegida
  private toStartISO(date: string, hourHHmm: string): string {
    const [y, m, d] = date.split('-').map(Number);
    const [H, Min] = hourHHmm.split(':').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, H, Min, 0, 0));
    return dt.toISOString();
  }

  public create() {
    if (!this.isBrowser()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const psyId = this.form.controls.psychologist_id.value;
    if (!psyId) { alert('Selecciona un psicólogo.'); return; }

    const body: any = {
      psychologist_id: psyId,
      start: this.toStartISO(this.form.controls.date.value, this.form.controls.hour.value),
    };

    if (this.role === 'psychologist') {
      const pid = this.form.controls.patient_id.value;
      if (!pid) { alert('Selecciona un paciente válido.'); return; }
      body.patient_id = pid;
    }

    this.creating = true;
    this.cdr.markForCheck();

    const sub = this.apSrv.create(body).subscribe({
      next: () => {
        alert('Cita creada ✅');
        this.refreshList();      // refrescar inmediatamente
      },
      error: (err) => {
        const m = (err?.error?.message || err?.message || '').toString();
        const map: Record<string, string> = {
          'DAY NOT AVAILABLE': 'Ese día no está disponible para este profesional.',
          'TIME NOT AVAILABLE IN SLOT': 'La hora no encaja en el horario publicado.',
          'TIME ALREADY BOOKED': 'Ya existe una cita en ese horario.',
          'PSYCHOLOGIST HAS NO AVAILABILITY': 'El profesional aún no publicó disponibilidad.',
          'DATE MUST BE IN THE FUTURE': 'La fecha/hora debe ser futura.',
          'INVALID PATIENT': 'Paciente inválido.',
          'INVALID PSYCHOLOGIST': 'Psicólogo inválido.',
        };
        alert(map[m] || m || 'No se pudo crear la cita.');
        console.error('[create appointment] status:', err?.status, 'url:', err?.url, 'body:', err?.error);
      }
    });

    sub.add(() => {
      this.creating = false;
      this.cdr.detectChanges();
    });
  }

  public delete(id: string) {
    if (!confirm('¿Cancelar esta cita?')) return;
    const sub = this.apSrv.delete(id).subscribe({
      next: () => { this.appointments = this.appointments.filter(a => a._id !== id); this.cdr.detectChanges(); },
      error: () => alert('No se pudo cancelar la cita.'),
    });
    sub.add(() => this.cdr.detectChanges());
  }

  public setStatus(a: AppointmentRow, status: AppointmentRow['status']) {
    if (this.role === 'patient' && (status === 'confirmada' || status === 'completada')) {
      alert('No tienes permisos para esa acción.');
      return;
    }
    if (a.status === 'completada' && this.role === 'psychologist' && status !== 'completada') {
      alert('No se puede reabrir una cita completada.');
      return;
    }
    if (a.status === 'cancelada' && this.role === 'psychologist') {
      alert('No se puede cambiar una cita cancelada.');
      return;
    }

    const sub = this.apSrv.updateStatus(a._id, status).subscribe({
      next: (r: any) => {
        const ap = r?.appointment ?? r;
        this.appointments = this.appointments.map(x => x._id === a._id ? { ...x, status: ap?.status ?? status } : x);
        this.cdr.detectChanges();
      },
      error: () => {
        alert('No se pudo actualizar el estado.');
      }
    });
    sub.add(() => this.cdr.detectChanges());
  }

  public findUserName(id: string): string {
    if (!id) return '';
    const p = this.patients.find(u => u._id === id);
    if (p?.name) return p.name;
    const s = this.psychologists.find(u => u._id === id);
    return s?.name || id;
  }
}
