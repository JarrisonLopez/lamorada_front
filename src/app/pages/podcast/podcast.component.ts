import { Component, PLATFORM_ID, signal, inject } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize, firstValueFrom } from 'rxjs';

import { PodcastService } from '../../services/podcast.service';
import { UserService } from '../../services/user.service';
import { decodeJwt } from '../../core/utils/jwt';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

type Podcast = {
  _id: string;
  title: string;
  description?: string;
  youtubeId: string;
  creator_id?: string;
  creator_name: string;
  createdAt?: string | Date;
};

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
  saving  = signal(false);
  err     = signal<string | null>(null);
  msg     = signal<string | null>(null);

  podcasts = signal<Podcast[]>([]);
  isPsych  = signal<boolean>(false);
  tab      = signal<'list'|'create'>('list');

  /** id del usuario autenticado para comprobar autoría */
  meId: string | null = null;

  form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(500)]],
    youtube: ['', [Validators.required]],
  });

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  async ngOnInit() {
    await this.resolveIdentityAndRole();
    this.fetch();
  }

  private async resolveIdentityAndRole() {
    if (!this.isBrowser) return;

    // 1) JWT rápido
    try {
      const t = this.userSvc.getToken();
      if (t) {
        const p: any = decodeJwt(t);
        const role = p?.role || p?.user?.role;
        const id   = p?.id || p?._id || p?.user?._id || p?.user?.id;
        if (role === 'psychologist') this.isPsych.set(true);
        if (id) this.meId = String(id);
      }
    } catch {}

    // 2) Fuente de verdad
    if (!this.meId || !this.isPsych()) {
      try {
        const me = await firstValueFrom(this.userSvc.getMe());
        if (me?._id) this.meId = String(me._id);
        if (me?.role === 'psychologist') this.isPsych.set(true);
      } catch {}
    }
  }

  fetch() {
    if (!this.isBrowser) return;
    this.loading.set(true);
    this.err.set(null);

    this.svc.getPodcasts()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.podcasts.set(res || []),
        error: () => this.err.set('No se pudieron cargar los podcasts.'),
      });
  }

  toTab(t: 'list'|'create') { this.tab.set(t); }

  /** URL de embed; el pipe SafeUrl la marcará como segura */
  buildEmbedUrl(id: string): string {
    const safe = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    return `https://www.youtube.com/embed/${safe}`;
  }

  private extractYouTubeId(input: string): string {
    const raw = (input || '').trim();
    if (/^[a-zA-Z0-9_-]{6,}$/.test(raw) && !raw.includes('http')) return raw;
    try {
      const u = new URL(raw);
      const v = u.searchParams.get('v');
      if (v) return v;
      if (u.hostname.includes('youtu') && u.pathname.length > 1) return u.pathname.slice(1);
      return raw;
    } catch { return raw; }
  }

  /** El autor es quien tiene creator_id == meId */
  isOwner(p: Podcast): boolean {
    const ownerId = p?.creator_id ? String(p.creator_id) : null;
    return !!(this.meId && ownerId && ownerId === this.meId);
  }

  create() {
    if (!this.isBrowser) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.saving.set(true);
    this.err.set(null);
    this.msg.set(null);

    const { title, description, youtube } = this.form.value;
    const youtubeId = this.extractYouTubeId(youtube);

    this.svc.createPodcast({ title, description, youtubeId })
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

  /** Eliminar (solo autor). Muestra mensaje claro si 403. */
  remove(p: Podcast) {
    if (!this.isOwner(p)) return;
    if (!confirm(`¿Eliminar el podcast "${p.title}"?`)) return;

    this.loading.set(true);
    this.err.set(null); this.msg.set(null);

    this.svc.deletePodcast(p._id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => { this.msg.set('Podcast eliminado.'); this.fetch(); },
        error: (e) => {
          if (e?.status === 401) this.err.set('No autenticado.');
          else if (e?.status === 403) this.err.set('No autorizado: solo el autor puede eliminarlo.');
          else this.err.set(e?.error?.message || 'No se pudo eliminar el podcast.');
        }
      });
  }
}
