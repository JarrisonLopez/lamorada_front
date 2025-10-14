import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AvailabilityService } from '../../services/availability.service';
import { firstValueFrom } from 'rxjs';

type Slot = { start: string; end: string };
type AvailabilityDoc = { _id?: string; days: string[]; slots: Slot[] };

const LABEL_ES: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

@Component({
  selector: 'app-availability-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './availability.component.html',
  styleUrls: ['./availability.component.css'],
})
export class AvailabilityViewComponent {
  constructor(
    private availabilitySvc: AvailabilityService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  loading = false;
  err: string | null = null;

  data: AvailabilityDoc | null = null;

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit(): void {
    this.load();
  }

  async load() {
    if (!this.isBrowser) return;
    this.loading = true; this.err = null;
    try {
      // AHORA el servicio devuelve el objeto o null (NO resp.availability)
      const resp = await firstValueFrom(this.availabilitySvc.getAvailability());
      this.data = resp ?? null;
    } catch (e: any) {
      this.err = e?.error?.message || 'Error al cargar disponibilidad';
      this.data = null;
    } finally {
      this.loading = false;
    }
  }

  labelES(dayKey: string): string {
    return LABEL_ES[dayKey] ?? dayKey;
  }
}
