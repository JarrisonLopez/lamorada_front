import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgFor, NgIf, isPlatformBrowser } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AvailabilityService } from '../../services/availability.service';
import { AvSlot, AvailabilityDoc } from '../../models/availability.model';
import { WEEKDAYS_EN, EN2ES, ES2EN, EN2ES_PLAIN } from '../../shared/day-utils';

type AvForm = FormGroup<{
  days: FormControl<string[]>;
  start: FormControl<string>;
  end: FormControl<string>;
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
      start: this.fb.control<string>('', {
        nonNullable: true,
        validators: [Validators.pattern(/^\d{2}:\d{2}$/)],
      }),
      end: this.fb.control<string>('', {
        nonNullable: true,
        validators: [Validators.pattern(/^\d{2}:\d{2}$/)],
      }),
    });
  }

  weekdays = WEEKDAYS_EN;
  form!: AvForm;

  slots: AvSlot[] = [];
  currentId: string | null = null;
  loading = true;
  saving = false;

  // UI banners
  msg: string | null = null;
  err: string | null = null;

  // Datos para preview semanal
  previewBars: Array<{ label: string; bars: { left: number; width: number }[] }> = [];

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading = false;
      return;
    }
    this.avSrv.getAvailability().subscribe({
      next: (doc) => {
        if (doc?._id) this.currentId = doc._id;
        const daysNormEN = (doc?.days ?? [])
          .map((v) => String(v ?? ''))
          .map((s) =>
            s
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .toLowerCase()
              .trim()
          )
          .map((s) => ES2EN[s] ?? s);
        const unique = Array.from(new Set(daysNormEN));
        const ordered = ALLOWED_EN.filter((d) => unique.includes(d));
        this.form.patchValue({ days: ordered });
        this.slots = this.mergeSlots(
          (doc?.slots ?? []).map((s) => ({ start: s.start, end: s.end }))
        );
        this.computePreview();
      },
      complete: () => (this.loading = false),
    });
  }

  /* ---------- Helpers de día y slots ---------- */
  toggleDay(en: string) {
    const cur = new Set(this.form.controls.days.value);
    cur.has(en) ? cur.delete(en) : cur.add(en);
    const next = ALLOWED_EN.filter((d) => cur.has(d)); // orden Monday..Sunday
    this.form.controls.days.setValue(next);
    this.computePreview();
  }
  dayLabel(en: string) {
    return EN2ES[en] ?? en;
  }

  private norm(hhmm: string): string {
    // Asegura 00/30 redondeando hacia abajo; simple y elegante
    const m = hhmm.match(/^(\d{2}):(\d{2})$/);
    if (!m) return hhmm;
    let H = +m[1],
      M = +m[2];
    M = M < 30 ? 0 : 30;
    return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
  }

  private toMin(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
  private toHHmm(min: number): string {
    const h = Math.floor(min / 60),
      m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  addSlot() {
    const s = this.norm(this.form.controls.start.value);
    const e = this.norm(this.form.controls.end.value);
    if (!/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(e)) {
      this.err = 'Formato de hora inválido.';
      return;
    }
    if (e <= s) {
      this.err = 'El fin debe ser mayor que el inicio.';
      return;
    }
    this.err = null;
    this.slots = this.mergeSlots([...this.slots, { start: s, end: e }]);
    this.form.controls.start.setValue('');
    this.form.controls.end.setValue('');
    this.computePreview();
  }

  addPreset(s: string, e: string) {
    this.slots = this.mergeSlots([...this.slots, { start: s, end: e }]);
    this.computePreview();
  }

  clearSlots() {
    this.slots = [];
    this.computePreview();
  }

  removeSlot(i: number) {
    this.slots = this.slots.filter((_, idx) => idx !== i);
    this.computePreview();
  }

  private mergeSlots(arr: AvSlot[]): AvSlot[] {
    // Convierte a minutos, ordena y fusiona solapes
    const sorted = arr
      .map((s) => ({ a: this.toMin(s.start), b: this.toMin(s.end) }))
      .filter((x) => x.b > x.a)
      .sort((x, y) => x.a - y.a);

    const out: { a: number; b: number }[] = [];
    for (const seg of sorted) {
      if (!out.length || seg.a > out[out.length - 1].b) out.push({ ...seg });
      else out[out.length - 1].b = Math.max(out[out.length - 1].b, seg.b);
    }
    return out.map((x) => ({ start: this.toHHmm(x.a), end: this.toHHmm(x.b) }));
  }

  /* ---------- Validación & Persistencia ---------- */
  private validate(daysEsPlain: string[], slots: AvSlot[]): string | null {
    if (!daysEsPlain.length) return 'Selecciona al menos un día.';
    if (!slots.length) return 'Agrega al menos un intervalo.';

    const allowedEsPlain = [
      'lunes',
      'martes',
      'miercoles',
      'jueves',
      'viernes',
      'sabado',
      'domingo',
    ];
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
    const daysEN = this.form.controls.days.value || [];
    const daysESplain = daysEN.map((d) => EN2ES_PLAIN[d] ?? d);
    const slots = this.mergeSlots(this.slots);

    const error = this.validate(daysESplain, slots);
    if (error) {
      this.err = error;
      this.msg = null;
      return;
    }

    const doc: AvailabilityDoc = { days: daysESplain, slots };
    this.saving = true;
    this.msg = null;
    this.err = null;

    this.avSrv.upsertAvailability(doc).subscribe({
      next: (r: any) => {
        const av = r?.availability ?? r;
        this.currentId = av?._id ?? this.currentId;
        this.msg = 'Disponibilidad guardada ✅';
      },
      error: (e) => {
        this.err = e?.error?.message || e?.message || 'No se pudo guardar.';
      },
      complete: () => (this.saving = false),
    });
  }

  deleteAll() {
    if (!this.currentId) {
      this.err = 'No hay disponibilidad para eliminar';
      this.msg = null;
      return;
    }
    if (!confirm('¿Eliminar tu disponibilidad publicada?')) return;

    this.avSrv.deleteAvailability(this.currentId).subscribe({
      next: (_) => {
        this.currentId = null;
        this.form.controls.days.setValue([]);
        this.slots = [];
        this.msg = 'Disponibilidad eliminada.';
        this.err = null;
        this.computePreview();
      },
      error: (_) => {
        this.err = 'No se pudo eliminar.';
        this.msg = null;
      },
    });
  }

  /* ---------- Vista previa semanal ---------- */
  private computePreview() {
    // construye barras para 00:00..24:00 (0..1440)
    const bars = this.mergeSlots(this.slots).map((s) => {
      const a = this.toMin(s.start),
        b = this.toMin(s.end);
      return {
        left: (a / 1440) * 100,
        width: ((b - a) / 1440) * 100,
      };
    });

    this.previewBars = (this.form.controls.days.value || []).map((d) => ({
      label: EN2ES[d] ?? d,
      bars,
    }));
  }
}
