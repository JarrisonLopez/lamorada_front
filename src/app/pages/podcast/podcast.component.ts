import { Component, PLATFORM_ID, signal, inject, computed } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { PodcastService } from '../../services/podcast.service';
import { UserService } from '../../services/user.service';
import { decodeJwt } from '../../core/utils/jwt';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

type Podcast = {
  _id: string;
  title: string;
  description?: string;
  youtubeId: string;
  creator_name: string;
  createdAt?: string | Date;
};

type SortKey = 'new' | 'old' | 'title';

@Component({
  standalone: true,
  selector: 'app-podcast',
  imports: [CommonModule, ReactiveFormsModule, DatePipe, SafeUrlPipe],
  templateUrl: './podcast.component.html',
  styleUrls: ['./podcast.component.css'],
})
export class PodcastComponent {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private svc = inject(PodcastService);
  private userSvc = inject(UserService);

  loading = signal(false);
  saving = signal(false);
  err = signal<string | null>(null);
  msg = signal<string | null>(null);

  podcasts = signal<Podcast[]>([]);
  isPsych = signal<boolean>(false);
  tab = signal<'list' | 'create'>('list');

  /** filtros UI */
  q = signal<string>(''); // búsqueda
  sort = signal<SortKey>('new'); // ordenar

  /** lista filtrada y ordenada */
  filtered = computed(() => {
    const q = this.q().toLowerCase().trim();
    let list = this.podcasts();

    if (q) {
      list = list.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.creator_name || '').toLowerCase().includes(q)
      );
    }

    const s = this.sort();
    list = [...list].sort((a, b) => {
      if (s === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      const da = new Date(a.createdAt || 0).getTime();
      const db = new Date(b.createdAt || 0).getTime();
      return s === 'old' ? da - db : db - da; // por defecto 'new'
    });

    return list;
  });

  form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(500)]],
    youtube: ['', [Validators.required]],
  });

  get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  async ngOnInit() {
    this.resolveRole();
    this.fetch();
  }

  /** Solo usamos el JWT para saber si es psicólogo (no hay eliminar) */
  private resolveRole() {
    if (!this.isBrowser) return;
    try {
      const t = this.userSvc.getToken();
      if (t) {
        const p: any = decodeJwt(t);
        const role = p?.role || p?.user?.role;
        if (role === 'psychologist') this.isPsych.set(true);
      }
    } catch { /* noop */ }
  }

  fetch() {
    if (!this.isBrowser) return;
    this.loading.set(true);
    this.err.set(null);
    this.svc
      .getPodcasts()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.podcasts.set(res || []),
        error: () => this.err.set('No se pudieron cargar los podcasts.'),
      });
  }

  toTab(t: 'list' | 'create') {
    this.tab.set(t);
  }

  /** URL de embed; estilo limpio */
  buildEmbedUrl(id: string): string {
    const safe = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    return `https://www.youtube.com/embed/${safe}?modestbranding=1&rel=0&color=white`;
  }

  private extractYouTubeId(input: string): string {
    const raw = (input || '').trim();
    if (/^[a-zA-Z0-9_-]{6,}$/.test(raw) && !raw.includes('http')) return raw;
    try {
      const u = new URL(raw);
      const v = u.searchParams.get('v');
      if (v) return v;
      if (u.hostname.includes('youtu') && u.pathname.length > 1) {
        return u.pathname.replace(/^\/(shorts\/)?/, '');
      }
      return raw;
    } catch {
      return raw;
    }
  }

  create() {
    if (!this.isBrowser) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.err.set(null);
    this.msg.set(null);

    const { title, description, youtube } = this.form.value;
    const youtubeId = this.extractYouTubeId(youtube);

    this.svc
      .createPodcast({ title, description, youtubeId })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.msg.set('Podcast creado correctamente.');
          this.form.reset();
          this.fetch();
          this.tab.set('list');
        },
        error: (e) => {
          if (e?.status === 401) this.err.set('Tu sesión expiró o no estás autenticado.');
          else if (e?.status === 403) this.err.set('No tienes permisos para esta acción.');
          else if (e?.status === 404) this.err.set('Endpoint de creación no encontrado.');
          else this.err.set(e?.error?.message || 'No se pudo crear el podcast.');
        },
      });
  }

  /* ========= Handlers de la toolbar ========= */
  onQueryInput(ev: Event) {
    this.q.set((ev.target as HTMLInputElement).value);
  }
  onSortChange(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value as SortKey;
    this.sort.set(value);
  }
}
