import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgIf, NgFor, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AvailabilityService } from '../../services/availability.service';
import { AvailabilityDoc } from '../../models/availability.model';
import { EN2ES, WEEKDAYS_EN, normDayKey } from '../../shared/day-utils';
import { UserService } from '../../services/user.service';

@Component({
  standalone: true,
  selector: 'app-availability',
  imports: [CommonModule, NgIf, NgFor, RouterLink],
  templateUrl: './availability.component.html',
  styleUrls: ['./availability.component.css'],
})
export class AvailabilityComponent {
  constructor(
    private avSrv: AvailabilityService,
    private userSrv: UserService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  loading = true;
  doc: AvailabilityDoc | null = null;
  role: 'patient' | 'psychologist' | null = null;

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit() {
    // Lee rol desde storage/JWT sin pegarle al back
    this.role = (this.userSrv.getRole() as any) ?? null;

    if (!this.isBrowser) { this.loading = false; return; }

    // GET /availability (solo disponible para psicólogo; si 401/403 mostramos mensaje)
    this.avSrv.getAvailability().subscribe({
      next: d => this.doc = d ?? null,
      error: _ => this.doc = null,
      complete: () => this.loading = false
    });
  }

  /** Normaliza cualquier entrada (ES con/sin tildes o EN) a EN y la ordena Monday..Sunday */
  get orderedDaysEn(): string[] {
    const raw = this.doc?.days ?? [];
    const norm = raw.map(normDayKey); // -> monday..sunday o deja tal cual si ya es EN
    const set = new Set(norm.map(d => d.toLowerCase()));
    return WEEKDAYS_EN.filter(d => set.has(d));
  }

  /** Etiqueta en ES con tildes para mostrar */
  labelDay(en: string) { return EN2ES[en] ?? en; }

  /** “Lunes, Martes, …” */
  daysJoined(): string {
    return this.orderedDaysEn.map(d => this.labelDay(d)).join(', ');
  }

  hasData(): boolean {
    return !!(this.doc?.days?.length && this.doc?.slots?.length);
  }
}
