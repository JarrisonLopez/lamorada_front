import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { PostApiService, PostDto } from '../../services/post-api.service';
import { UserService } from '../../services/user.service';
import { decodeJwt } from '../../core/utils/jwt';

type Post = {
  _id: string;
  title: string;
  content: string;
  active?: boolean;
  psychologist_id?: string | { _id: string };
  created_at?: string | Date;
};

@Component({
  standalone: true,
  selector: 'app-post-editor',
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './post-editor.component.html',
  styleUrls: ['./post-editor.component.css'],
})
export class PostEditorComponent {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private svc = inject(PostApiService);
  private userSvc = inject(UserService);

  isBrowser = isPlatformBrowser(this.platformId);
  loading = signal(false);
  saving = signal(false);
  err = signal<string | null>(null);
  msg = signal<string | null>(null);

  meId: string | null = null;
  myPosts = signal<Post[]>([]);

  // Counters/preview helpers
  now = new Date();
  titleLen = 0;
  contentLen = 0;
  titlePct = 0;
  contentPct = 0;
  words = 0;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    content: ['', [Validators.required, Validators.minLength(10)]],
    active: [true],
  });

  constructor() {
    if (this.isBrowser) {
      this.resolveIdentity();
      this.restoreDraft();
      this.fetchMine();
      this.updateCounters();
      // Auto-guardado del borrador
      this.form.valueChanges.subscribe(() => this.saveDraft());
    }
  }

  /** Lee identidad del JWT para filtrar y validar permisos */
  private resolveIdentity() {
    try {
      const t = this.userSvc.getToken();
      if (!t) return;
      const p: any = decodeJwt(t);
      const role = p?.role || p?.user?.role;
      const id = p?.user_id || p?.id || p?._id || p?.user?._id || p?.user?.id;
      if (role !== 'psychologist') this.err.set('Debes ser psicólogo para crear publicaciones.');
      if (id) this.meId = String(id);
    } catch {}
  }

  private isMine(post: Post): boolean {
    const pid = post?.psychologist_id;
    const asString = typeof pid === 'string' ? pid : pid && (pid as any)._id;
    return !!(this.meId && asString && String(asString) === this.meId);
  }

  fetchMine() {
    if (!this.isBrowser) return;
    this.loading.set(true);
    this.err.set(null);
    this.svc
      .getAllRawAuth()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (posts) => {
          const list = (Array.isArray(posts) ? posts : []) as Post[];
          this.myPosts.set(list.filter((p) => this.isMine(p)));
        },
        error: () => this.err.set('No se pudieron cargar tus publicaciones.'),
      });
  }

  /** Inserta texto rápido en el contenido */
  insertTemplate(key: 'respiro' | 'mind' | 'tips') {
    const map: Record<string, string> = {
      respiro:
        '🫁 Respiración consciente\n\n' +
        '1) Inhala por la nariz 4s\n2) Retén 2s\n3) Exhala 6s\n' +
        'Repite 3–5 minutos. Observa sensaciones sin juzgarlas.',
      mind:
        '🧘‍♀️ Minuto de mindfulness\n\n' +
        '• Lleva atención a la respiración.\n• Observa sonidos/olores.\n• Vuelve amablemente a tu ancla.',
      tips:
        '✨ Tips rápidos\n\n' +
        '• Dormir 7–8h\n• Hidratación constante\n• Pausas breves cada 50min\n• Movimiento diario suave',
    };
    const v = map[key];
    const prev = this.form.value.content || '';
    const join = prev && !prev.endsWith('\n') ? '\n\n' : '';
    this.form.patchValue({ content: (prev + join + v).trim() });
    this.updateCounters();
  }

  /** Contadores + barra de progreso */
  updateCounters() {
    const title = (this.form.value.title || '').toString();
    const content = (this.form.value.content || '').toString();

    this.titleLen = title.length;
    this.contentLen = content.length;
    this.titlePct = Math.min(100, Math.round((this.titleLen / 160) * 100));
    this.words = content.trim().length ? content.trim().split(/\s+/).length : 0;

    // Barra de “llenado” de contenido: heurística sobre 800 chars
    const target = 800;
    this.contentPct = Math.min(100, Math.round((this.contentLen / target) * 100));
  }

  /** Ctrl/⌘ + Enter -> submit */
  submitShortcut() {
    if (!this.saving() && this.form.valid) this.create();
  }

  /** Draft en localStorage */
  private draftKey = 'post_editor_draft_v1';
  private saveDraft() {
    try {
      localStorage.setItem(this.draftKey, JSON.stringify(this.form.getRawValue()));
    } catch {}
  }
  private restoreDraft() {
    try {
      const raw = localStorage.getItem(this.draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && typeof draft === 'object') {
        this.form.patchValue(
          {
            title: draft.title ?? '',
            content: draft.content ?? '',
            active: draft.active ?? true,
          },
          { emitEvent: false }
        );
      }
    } catch {}
  }
  private clearDraft() {
    try {
      localStorage.removeItem(this.draftKey);
    } catch {}
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

    const dto: PostDto = {
      title: this.form.value.title!,
      content: this.form.value.content!,
      active: !!this.form.value.active,
    };

    this.svc
      .create(dto)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.msg.set('Publicación creada.');
          this.form.reset({ title: '', content: '', active: true });
          this.clearDraft();
          this.updateCounters();
          this.fetchMine();
        },
        error: (e) => {
          if (e?.status === 401) this.err.set('Tu sesión expiró o no estás autenticado.');
          else if (e?.status === 403) this.err.set('No tienes permisos para esta acción.');
          else if (e?.status === 404) this.err.set('Endpoint de creación no encontrado.');
          else this.err.set(e?.error?.message || 'No se pudo crear la publicación.');
        },
      });
  }

  remove(p: Post) {
    if (!this.isMine(p)) return;
    if (!confirm(`¿Eliminar "${p.title}"?`)) return;

    this.loading.set(true);
    this.err.set(null);
    this.msg.set(null);

    this.svc
      .remove(p._id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.msg.set('Publicación eliminada.');
          this.fetchMine();
        },
        error: (e) => {
          if (e?.status === 401) this.err.set('No autenticado.');
          else if (e?.status === 403)
            this.err.set('No autorizado (solo el autor puede eliminarla).');
          else this.err.set(e?.error?.message || 'No se pudo eliminar.');
        },
      });
  }
}
