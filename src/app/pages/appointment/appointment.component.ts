import { Component, Inject, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AppointmentService } from '../../services/appointment.service';
import { UserService } from '../../services/user.service';

type Role = 'patient' | 'psychologist' | null;

@Component({
  selector: 'app-appointment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './appointment.component.html',
  styleUrls: ['./appointment.component.css'],
})
export class AppointmentComponent {
  private fb = inject(FormBuilder);
  private appt = inject(AppointmentService);
  private users = inject(UserService);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  form: FormGroup = this.fb.group({
    date: ['', Validators.required],       // yyyy-MM-dd
    time: ['', Validators.required],       // HH:mm
    psychologist_id: ['', Validators.required],
    patient_id: [''],                      // requerido solo si role=psychologist
    notes: [''],
  });

  loading = false;
  msg: string | null = null;
  err: string | null = null;

  minDate = '';
  minTime = '00:00';
  role: Role = null;

  psychologists: any[] = [];
  patients: any[] = [];

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit(): void {
    // fecha mínima = hoy
    const now = new Date();
    const yyyy = now.getFullYear(), mm = String(now.getMonth()+1).padStart(2,'0'), dd = String(now.getDate()).padStart(2,'0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
    this.form.get('date')!.setValue(this.minDate);
    this.updateMinTime();

    this.form.get('date')!.valueChanges.subscribe(() => this.updateMinTime());

    // rol del jwt
    this.role = this.readRoleFromToken();

    // si soy psicólogo, patient_id es requerido en el form
    if (this.role === 'psychologist') {
      this.form.get('patient_id')!.addValidators([Validators.required]);
    }

    this.loadLists();
  }

  private readRoleFromToken(): Role {
    if (!this.isBrowser) return null;
    try {
      const t = localStorage.getItem('token'); if (!t) return null;
      const p: any = JSON.parse(atob(t.split('.')[1]));
      return (p?.role || p?.user?.role || null) as Role;
    } catch { return null; }
  }

  private nextQuarter(d: Date): string {
    const n = new Date(d.getTime());
    n.setSeconds(0,0);
    const mins = n.getMinutes();
    const step = [0,15,30,45].find(x => x > mins);
    if (step !== undefined) n.setMinutes(step); else { n.setHours(n.getHours()+1); n.setMinutes(0); }
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  }
  private updateMinTime() {
    const date = this.form.get('date')!.value as string;
    if (date === this.minDate) this.minTime = this.nextQuarter(new Date());
    else this.minTime = '00:00';
    const cur = this.form.get('time')!.value as string;
    if (cur && !this.isFuture(date, cur)) this.form.get('time')!.setValue(this.minTime);
  }
  private isFuture(date: string, time: string): boolean {
    if (!date || !time) return false;
    const [Y,M,D] = date.split('-').map(Number);
    const [h,m]   = time.split(':').map(Number);
    const dt = new Date(Y, (M??1)-1, D??1, h??0, m??0, 0, 0);
    return dt.getTime() > Date.now();
  }

  private async loadLists() {
    try {
      const pys = await firstValueFrom(this.users.getPsychologists());
      this.psychologists = Array.isArray(pys?.users) ? pys.users : (Array.isArray(pys) ? pys : []);
    } catch { this.psychologists = []; }

    if (this.role === 'psychologist') {
      try {
        const pa = await firstValueFrom(this.users.getPatients());
        this.patients = Array.isArray(pa?.users) ? pa.users : (Array.isArray(pa) ? pa : []);
      } catch { this.patients = []; }
    }
  }

  private toStartISO(date: string, time: string): string {
    // construimos 'YYYY-MM-DDTHH:mm:00' (local) → ISO
    const [Y,M,D] = date.split('-').map(Number);
    const [h,m]   = time.split(':').map(Number);
    const local = new Date(Y, (M??1)-1, D??1, h??0, m??0, 0, 0);
    return local.toISOString();
  }

  async submit() {
    this.msg = null; this.err = null;
    if (this.form.invalid) { this.err = 'Completa los campos obligatorios.'; return; }
    const date = this.form.value.date as string;
    const time = this.form.value.time as string;
    if (!this.isFuture(date, time)) { this.err = 'Selecciona fecha y hora futuras.'; return; }

    const body: any = {
      psychologist_id: this.form.value.psychologist_id,
      start: this.toStartISO(date, time),
    };
    if (this.role === 'psychologist') body.patient_id = this.form.value.patient_id;

    this.loading = true;
    try {
      await firstValueFrom(this.appt.create(body));
      this.msg = 'Cita creada.';
    } catch (e: any) {
      // El backend nos devuelve "DAY NOT AVAILABLE", "TIME NOT AVAILABLE IN SLOT", etc.
      this.err = e?.error?.message || 'Error interno del servidor';
    } finally {
      this.loading = false;
    }
  }
}
