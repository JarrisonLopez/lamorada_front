import { Component, Inject, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppointmentService } from '../../services/appointment.service';
import { UserService } from '../../services/user.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-appointment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './appointment.component.html',
  styleUrls: ['./appointment.component.css'],
})
export class AppointmentComponent implements OnInit {
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    date: ['', Validators.required],
    time: ['', Validators.required],
    psychologist_id: [''],
    notes: [''],
  });

  minDate = ''; // yyyy-MM-dd (hoy)
  minTime = '00:00'; // HH:mm (se ajusta a próximos 15 min si es hoy)

  loading = false;
  msg: string | null = null;
  err: string | null = null;

  psychologists: any[] = [];

  constructor(
    private appt: AppointmentService,
    private users: UserService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;

    // Seteamos fecha por defecto = hoy y calculamos minTime
    this.form.get('date')!.setValue(this.minDate);
    this.updateMinTime();

    // recalcular límites al cambiar fecha/hora
    this.form.get('date')!.valueChanges.subscribe(() => this.updateMinTime());
    this.form.get('time')!.valueChanges.subscribe(() => this.clearMessages());

    this.loadPsychologists();
  }

  private clearMessages() {
    this.msg = null;
    this.err = null;
  }

  private async loadPsychologists() {
    try {
      const r = await firstValueFrom(this.users.getPsychologists());
      this.psychologists = Array.isArray(r?.users) ? r.users : Array.isArray(r) ? r : [];
    } catch {
      this.psychologists = [];
    }
  }

  role(): 'patient' | 'psychologist' | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const t = localStorage.getItem('token');
      if (!t) return null;
      const payload = JSON.parse(atob(t.split('.')[1]));
      return (payload?.role || payload?.user_role || payload?.user?.role || null) as any;
    } catch {
      return null;
    }
  }

  /** Redondea la hora actual a los próximos 15 minutos (00, 15, 30, 45) */
  private nextQuarter(now = new Date()): string {
    const n = new Date(now);
    n.setSeconds(0, 0);
    const mins = n.getMinutes();
    const jump = [0, 15, 30, 45].find((m) => m > mins);
    if (jump !== undefined) {
      n.setMinutes(jump);
    } else {
      n.setHours(n.getHours() + 1);
      n.setMinutes(0);
    }
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }

  /** Si la fecha seleccionada es hoy, minTime = próximos 15 min; si no, 00:00 */
  private updateMinTime() {
    const date: string = this.form.get('date')!.value;
    const todayStr = this.minDate;
    if (date === todayStr) {
      this.minTime = this.nextQuarter(new Date());
      // Si el time actual quedó por debajo, súbelo al mínimo
      const current = this.form.get('time')!.value as string;
      if (current && !this.isFuture(date, current)) {
        this.form.get('time')!.setValue(this.minTime);
      }
    } else {
      this.minTime = '00:00';
    }
  }

  /** Valida que fecha+hora estén en el futuro */
  private isFuture(dateStr: string, timeStr: string): boolean {
    if (!dateStr || !timeStr) return false;
    // Construimos fecha local segura
    const [h, m] = timeStr.split(':').map(Number);
    const [Y, M, D] = dateStr.split('-').map(Number);
    const dt = new Date(Y, (M ?? 1) - 1, D ?? 1, h ?? 0, m ?? 0, 0, 0);
    return dt.getTime() > Date.now();
  }

  async submit() {
    this.msg = null;
    this.err = null;

    if (this.form.invalid) {
      this.err = 'Completa los campos requeridos.';
      return;
    }

    const date: string = this.form.value.date;
    const time: string = this.form.value.time;

    // Validación final: no permitir horas pasadas
    if (!this.isFuture(date, time)) {
      if (date === this.minDate) {
        this.err = `Para hoy, selecciona una hora posterior a ${this.minTime}.`;
      } else {
        this.err = 'Selecciona una fecha y hora futuras.';
      }
      return;
    }

    this.loading = true;
    try {
      const payload = {
        date,
        time,
        notes: this.form.value.notes || '',
        psychologist_id: this.form.value.psychologist_id || undefined,
      };
      const resp = await firstValueFrom(this.appt.createAppointment(payload));
      this.msg = resp?.message || 'Cita creada.';
      this.form.get('notes')?.reset('');
    } catch (e: any) {
      this.err = e?.error?.message || 'Error al crear la cita';
    } finally {
      this.loading = false;
    }
  }

  // ---------- Helpers UI (chips y resumen) ----------
  psychName(): string {
    const id = this.form?.value?.psychologist_id || '';
    const p = (this.psychologists || []).find((x: any) => x?._id === id);
    return p?.name || 'Cualquiera';
  }

  previewDate(): string {
    const d = this.form?.value?.date;
    if (!d) return '';
    const [Y, M, D] = d.split('-');
    return `${D}/${M}/${Y}`;
  }

  previewTime(): string {
    const t = this.form?.value?.time;
    if (!t) return '';
    return t;
  }

  pickToday(): void {
    this.form.get('date')?.setValue(this.minDate);
    this.updateMinTime();
  }

  pickTomorrow(): void {
    const n = new Date();
    n.setDate(n.getDate() + 1);
    const yyyy = n.getFullYear();
    const mm = String(n.getMonth() + 1).padStart(2, '0');
    const dd = String(n.getDate()).padStart(2, '0');
    const tomorrow = `${yyyy}-${mm}-${dd}`;
    this.form.get('date')?.setValue(tomorrow);
    this.updateMinTime();
  }
}
