import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AvailabilityService } from '../../services/availability.service';
import { firstValueFrom } from 'rxjs';

type Slot = { start: string; end: string };
type AvailabilityDoc = { _id?: string; days: string[]; slots: Slot[] };

const WEEK_DAYS = [
  { key: 'monday',    label: 'Lunes' },
  { key: 'tuesday',   label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday',  label: 'Jueves' },
  { key: 'friday',    label: 'Viernes' },
  { key: 'saturday',  label: 'Sábado' },
  { key: 'sunday',    label: 'Domingo' },
];

@Component({
  selector: 'app-availability-manage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './availability-manage.component.html',
  styleUrls: ['./availability-manage.component.css'],
})
export class AvailabilityManageComponent {
  private fb = inject(FormBuilder);
  constructor(private availability: AvailabilityService) {}

  loading = false;
  msg: string | null = null;
  err: string | null = null;

  docId: string | null = null;
  days = WEEK_DAYS;

  form: FormGroup = this.fb.group({
    days: this.fb.control<string[]>([], { validators: [Validators.required] }),
    slots: this.fb.array<FormGroup>([])
  });

  ngOnInit(): void {
    this.load();
    if (this.slotsFA.length === 0) this.addSlot({ start: '09:00', end: '10:00' });
  }

  // helpers
  get slotsFA(): FormArray<FormGroup> {
    return this.form.get('slots') as FormArray<FormGroup>;
  }
  slotGroupAt(i: number): FormGroup {
    return this.slotsFA.at(i) as FormGroup;
  }
  trackSlot = (i: number) => i;

  addSlot(initial?: Slot) {
    const g = this.fb.group({
      start: this.fb.control<string>(initial?.start ?? '09:00', { nonNullable: true, validators: [Validators.required] }),
      end:   this.fb.control<string>(initial?.end   ?? '10:00', { nonNullable: true, validators: [Validators.required] }),
    });
    this.slotsFA.push(g);
  }

  removeSlot(i: number) { this.slotsFA.removeAt(i); }

  toggleDay(dayKey: string, checked: boolean) {
    const current = [...(this.form.value.days || [])];
    const next = checked ? Array.from(new Set([...current, dayKey])) : current.filter(d => d !== dayKey);
    this.form.get('days')!.setValue(next);
  }

  async load() {
    this.loading = true; this.msg = null; this.err = null;
    try {
      const resp = await firstValueFrom(this.availability.getAvailability());
      const docs: AvailabilityDoc[] = Array.isArray(resp) ? resp : (resp?.items ?? []);
      const one = docs?.[0] ?? null;

      while (this.slotsFA.length) this.slotsFA.removeAt(0);

      if (one) {
        this.docId = one._id ?? null;
        this.form.patchValue({ days: one.days ?? [] });
        (one.slots ?? []).forEach(s => this.addSlot(s));
      } else {
        this.docId = null;
        this.form.patchValue({ days: [] });
        this.addSlot({ start: '09:00', end: '10:00' });
      }
    } catch (e: any) {
      this.err = (e?.status === 401 || e?.status === 403)
        ? 'Tu cuenta no tiene permisos para ver/editar la disponibilidad.'
        : (e?.error?.message || 'Error al cargar disponibilidad');
    } finally {
      this.loading = false;
    }
  }

  private validateSlots(): string | null {
    const slots: Slot[] = this.slotsFA.controls.map(c => ({
      start: c.get('start')!.value,
      end:   c.get('end')!.value
    }));
    for (const s of slots) {
      if (!s.start || !s.end) return 'Todos los intervalos deben tener hora inicial y final.';
      if (s.end <= s.start) return 'Cada intervalo debe terminar después de su inicio.';
    }
    return null;
  }

  async save() {
    this.msg = null; this.err = null;
    if (this.form.invalid) { this.err = 'Completa los campos requeridos.'; return; }
    const slotErr = this.validateSlots(); if (slotErr) { this.err = slotErr; return; }

    const payload: AvailabilityDoc = {
      days: this.form.value.days ?? [],
      slots: (this.form.value.slots ?? []) as Slot[],
    };

    this.loading = true;
    try {
      await firstValueFrom(this.availability.upsertAvailability(payload));
      this.msg = 'Disponibilidad guardada.';
      await this.load();
    } catch (e: any) {
      this.err = e?.error?.message || 'No se pudo guardar la disponibilidad';
    } finally {
      this.loading = false;
    }
  }

  async delete() {
    if (!this.docId) return;
    this.loading = true; this.msg = null; this.err = null;
    try {
      await firstValueFrom(this.availability.deleteAvailability(this.docId));
      this.msg = 'Disponibilidad eliminada.';
      await this.load();
    } catch (e: any) {
      this.err = e?.error?.message || 'No se pudo eliminar la disponibilidad';
    } finally {
      this.loading = false;
    }
  }
}
