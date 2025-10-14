import { Component, Inject, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AvailabilityService } from '../../services/availability.service';

type Slot = { start: string; end: string };
type AvailabilityDoc = { _id?: string; days: string[]; slots: Slot[] };

const DAYS = [
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
  private svc = inject(AvailabilityService);
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  loading = false;
  err: string | null = null;
  msg: string | null = null;

  days = DAYS;
  docId: string | null = null;

  form: FormGroup = this.fb.group({
    days: this.fb.control<string[]>([], { validators: [Validators.required] }),
    slots: this.fb.array<FormGroup>([]),
  });

  get slotsFA(): FormArray<FormGroup> { return this.form.get('slots') as FormArray<FormGroup>; }
  slotAt(i: number): FormGroup { return this.slotsFA.at(i) as FormGroup; }
  trackIdx = (i: number) => i;

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit(): void {
    this.load();
  }

  // UI helpers
  toggleDay(key: string, checked: boolean) {
    const current = [...(this.form.value.days ?? [])];
    const next = checked ? Array.from(new Set([...current, key])) : current.filter(k => k !== key);
    this.form.get('days')!.setValue(next);
  }

  addSlot(initial: Slot = { start: '09:00', end: '17:00' }) {
    const g = this.fb.group({
      start: this.fb.control<string>(initial.start, { nonNullable: true, validators: [Validators.required] }),
      end:   this.fb.control<string>(initial.end,   { nonNullable: true, validators: [Validators.required] }),
    });
    this.slotsFA.push(g);
  }
  removeSlot(i: number) { if (this.slotsFA.length > 1) this.slotsFA.removeAt(i); }

  private clearSlots() { while (this.slotsFA.length) this.slotsFA.removeAt(0); }

  async load() {
    if (!this.isBrowser) return;
    this.loading = true; this.err = null; this.msg = null;
    try {
      const data = await firstValueFrom(this.svc.getAvailability());
      this.clearSlots();

      if (data) {
        this.docId = (data as any)?._id ?? null;
        this.form.patchValue({ days: data.days ?? [] });
        (data.slots ?? []).forEach(s => this.addSlot(s));
        if (this.slotsFA.length === 0) this.addSlot();
      } else {
        // Prefill simple: lunes a viernes, 09–17
        this.docId = null;
        this.form.patchValue({ days: ['monday','tuesday','wednesday','thursday','friday'] });
        this.addSlot({ start: '09:00', end: '17:00' });
      }
    } catch (e: any) {
      this.err = e?.error?.message || 'Error al cargar disponibilidad';
    } finally {
      this.loading = false;
    }
  }

  private validateSlots(): string | null {
    const slots: Slot[] = (this.form.value.slots ?? []) as Slot[];
    if (!slots?.length) return 'Debes definir al menos 1 intervalo.';
    for (const s of slots) {
      if (!s?.start || !s?.end) return 'Todos los intervalos deben tener inicio y fin.';
      if (s.end <= s.start) return 'Cada intervalo debe terminar después de su inicio.';
    }
    return null;
  }

  async save() {
    this.msg = null; this.err = null;

    if (this.form.invalid) { this.err = 'Selecciona al menos un día.'; return; }
    const slotErr = this.validateSlots(); if (slotErr) { this.err = slotErr; return; }

    const selectedDays: string[] = (this.form.value.days ?? []).map((d: string) => String(d).toLowerCase());
    const slots: Slot[] = (this.form.value.slots ?? []) as Slot[];

    // *** Requisito del backend: misma cantidad de slots que de days ***
    let payloadSlots: Slot[];
    if (slots.length === selectedDays.length) {
      payloadSlots = slots;
    } else if (slots.length === 1 && selectedDays.length > 1) {
      payloadSlots = Array.from({ length: selectedDays.length }, () => ({ ...slots[0] }));
    } else {
      // Si hay N>1 slots y no coincide, tomamos el primero repetido (simple y válido)
      payloadSlots = Array.from({ length: selectedDays.length }, () => ({ ...slots[0] }));
    }

    const payload: AvailabilityDoc = {
      days: selectedDays,     // inglés minúscula
      slots: payloadSlots,    // tantas entradas como días
    };

    this.loading = true;
    try {
      await firstValueFrom(this.svc.upsertAvailability(payload));
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
    this.loading = true; this.err = null; this.msg = null;
    try {
      await firstValueFrom(this.svc.deleteAvailability(this.docId));
      this.msg = 'Disponibilidad eliminada.';
      await this.load();
    } catch (e: any) {
      this.err = e?.error?.message || 'No se pudo eliminar la disponibilidad';
    } finally {
      this.loading = false;
    }
  }
}
