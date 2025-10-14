import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgFor, NgIf, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AvailabilityService } from '../../services/availability.service';
import { AvSlot, AvailabilityDoc } from '../../models/availability.model';
import { WEEKDAYS_EN, EN2ES, ES2EN, EN2ES_PLAIN } from '../../shared/day-utils';

type AvForm = FormGroup<{
  days: FormControl<string[]>;
  start: FormControl<string>;
  end:   FormControl<string>;
}>;

const ALLOWED_EN = WEEKDAYS_EN; // ['monday'..'sunday']

@Component({
  standalone: true,
  selector: 'app-availability-manage',
  imports: [CommonModule, ReactiveFormsModule, NgIf, NgFor],
  templateUrl: './availability-manage.component.html',
  styleUrls: ['./availability-manage.component.css'],
})
export class AvailabilityManageComponent {
  constructor(
    private fb: FormBuilder,
    private avSrv: AvailabilityService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.form = this.fb.group({
      days: this.fb.control<string[]>([], { nonNullable: true }),
      start: this.fb.control<string>('', { nonNullable: true, validators: [Validators.pattern(/^\d{2}:\d{2}$/)] }),
      end:   this.fb.control<string>('', { nonNullable: true, validators: [Validators.pattern(/^\d{2}:\d{2}$/)] }),
    });
  }

  weekdays = WEEKDAYS_EN;
  form!: AvForm;

  slots: AvSlot[] = [];
  currentId: string | null = null;
  loading = true;
  saving  = false;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) { this.loading = false; return; }
    this.avSrv.getAvailability().subscribe({
      next: doc => {
        if (doc?._id) this.currentId = doc._id;
        // Normaliza cualquier cosa a EN para los chips
        const daysNormEN = (doc?.days ?? [])
          .map(v => String(v ?? ''))
          .map(s => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim())
          .map(s => ES2EN[s] ?? s);
        const unique = Array.from(new Set(daysNormEN));
        const ordered = ALLOWED_EN.filter(d => unique.includes(d));
        this.form.patchValue({ days: ordered });
        this.slots = (doc?.slots ?? []).map(s => ({ start: s.start, end: s.end }));
      },
      complete: () => this.loading = false
    });
  }

  toggleDay(en: string) {
    const cur = new Set(this.form.controls.days.value);
    cur.has(en) ? cur.delete(en) : cur.add(en);
    const next = ALLOWED_EN.filter(d => cur.has(d)); // orden Monday..Sunday
    this.form.controls.days.setValue(next);
  }
  dayLabel(en: string) { return EN2ES[en] ?? en; }

  addSlot() {
    const s = this.form.controls.start.value;
    const e = this.form.controls.end.value;
    if (!/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(e)) return;
    if (e <= s) return;
    this.slots = [...this.slots, { start: s, end: e }];
    this.form.controls.start.setValue('');
    this.form.controls.end.setValue('');
  }
  removeSlot(i: number) { this.slots = this.slots.filter((_, idx) => idx !== i); }

  private validate(daysEsPlain: string[], slots: AvSlot[]): string | null {
    if (!daysEsPlain.length) return 'Selecciona al menos un día.';
    if (!slots.length) return 'Agrega al menos un intervalo.';

    const allowedEsPlain = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
    for (const d of daysEsPlain) {
      if (!allowedEsPlain.includes(d)) return `Día inválido: "${d}"`;
    }
    const hhmm = /^\d{2}:\d{2}$/;
    for (const s of slots) {
      if (!hhmm.test(s.start) || !hhmm.test(s.end)) return 'Formato de hora inválido.';
      if (s.end <= s.start) return 'Cada intervalo debe tener fin mayor que inicio.';
    }
    return null;
  }

  save() {
    // 1) Obtenemos la selección interna (EN) y la convertimos a ES plano (sin tildes) para el backend
    const daysEN = this.form.controls.days.value || [];
    const daysESplain = daysEN.map(d => EN2ES_PLAIN[d] ?? d);

    const slots = this.slots.map(s => ({ start: s.start, end: s.end }));
    const error = this.validate(daysESplain, slots);
    if (error) { alert(error); return; }

    const doc: AvailabilityDoc = { days: daysESplain, slots };
    // eslint-disable-next-line no-console
    console.log('[POST /availability] (ES sin tildes) =>', JSON.stringify(doc));

    this.saving = true;
    this.avSrv.upsertAvailability(doc).subscribe({
      next: (r: any) => {
        const av = r?.availability ?? r;
        this.currentId = av?._id ?? this.currentId;
        alert('Disponibilidad guardada ✅');
      },
      error: (err) => {
        const msg = (err?.error?.message || err?.message || '').toString();
        alert(msg || 'No se pudo guardar.');
        // eslint-disable-next-line no-console
        console.error('[availability save] status:', err?.status, 'url:', err?.url, 'body:', err?.error);
      },
      complete: () => this.saving = false
    });
  }

  deleteAll() {
    if (!this.currentId) { alert('No hay disponibilidad para eliminar'); return; }
    if (!confirm('¿Eliminar tu disponibilidad publicada?')) return;

    this.avSrv.deleteAvailability(this.currentId).subscribe({
      next: _ => {
        this.currentId = null;
        this.form.controls.days.setValue([]);
        this.slots = [];
        alert('Disponibilidad eliminada.');
      },
      error: _ => alert('No se pudo eliminar.')
    });
  }
}
