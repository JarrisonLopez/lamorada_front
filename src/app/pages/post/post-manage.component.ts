import { Component, Inject, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { PostService, Post } from '../../services/post.service';

type AuthorObj = { _id: string; name?: string; last_name1?: string; last_name2?: string };

@Component({
  standalone: true,
  selector: 'app-post-manage',
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './post-manage.component.html',
  styleUrls: ['./post-manage.component.css'],
})
export class PostManageComponent {
  private platformId = inject(PLATFORM_ID);
  private svc = inject(PostService);
  private fb = inject(FormBuilder);

  loading = false;
  saving = false;
  err: string | null = null;
  msg: string | null = null;

  posts: Post[] = [];
  isPsychologist = false;
  myId: string | null = null;
  myName: string | null = null;

  // edición
  editingId: string | null = null;
  editForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    content: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  // creación
  form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    content: ['', [Validators.required, Validators.maxLength(5000)]],
    active: [true],
  });

  // ponlo en true si quieres ver el debug
  debug = false;

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.clearMessages();
    this.isPsychologist = this.svc.getRoleFromToken() === 'psychologist';
    this.myId = this.svc.getUserIdFromToken();
    this.myName = this.svc.getNameFromToken();
    this.fetch();
  }

  // ───────── helpers UI ─────────
  private clearMessages(delayMs = 0) {
    if (!delayMs) { this.err = null; this.msg = null; return; }
    setTimeout(() => { this.err = null; this.msg = null; }, delayMs);
  }
  private toastOk(text: string) { this.msg = text; this.err = null; this.clearMessages(2500); }
  private toastErr(text: string) { this.err = text; this.msg = null; this.clearMessages(3500); }

  /** id del autor del post */
  ownerId(p: Post): string | null {
    const a: any = p.psychologist_id;
    if (!a) return null;
    return typeof a === 'string' ? a : a._id ?? null;
  }
  /** nombre para mostrar */
  authorName(p: Post): string {
    const a: any = p.psychologist_id;
    if (a && typeof a === 'object') {
      const parts = [a.name, a.last_name1, a.last_name2].filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
    const owner = this.ownerId(p);
    if (owner && this.myId && owner === this.myId && this.myName) return this.myName;
    return '—';
  }
  isOwner(p: Post): boolean {
    const owner = this.ownerId(p);
    return !!owner && !!this.myId && owner === this.myId;
  }

  // ───────── data ─────────
  fetch() {
    this.loading = true;
    this.err = null;
    this.svc.getPosts(true)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (list: Post[]) => {
          this.posts = list ?? [];
          this.clearMessages();
          if (!this.posts.length) this.msg = 'No hay publicaciones.';
        },
        error: (e) => {
          this.toastErr(e?.error?.message || e?.message || 'No se pudieron cargar los artículos.');
        },
      });
  }

  // ───────── crear ─────────
  create() {
    if (!this.isBrowser || !this.isPsychologist) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.saving = true;
    this.err = null;

    const payload = {
      title: (this.form.value.title || '').toString(),
      content: (this.form.value.content || '').toString(),
      active: !!this.form.value.active,
    };

    this.svc.createPost(payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (created: Post) => {
          this.toastOk('Artículo creado.');
          this.form.reset({ title: '', content: '', active: true });

          // Rellenar autor si el back no lo popule
          if (created) {
            if (!created.psychologist_id || typeof created.psychologist_id === 'string') {
              const _id = (typeof created.psychologist_id === 'string')
                ? created.psychologist_id
                : (this.myId ?? '');
              const author: AuthorObj = { _id };
              if (this.myName) author.name = this.myName;
              (created as any).psychologist_id = author;
            }
            // Insertar arriba sin refetch
            this.posts = [created, ...this.posts];
          } else {
            this.fetch();
          }
        },
        error: (e) => {
          const txt = e?.error?.message ||
            (e?.status === 401 ? 'Tu sesión expiró o no estás autenticado.' :
             e?.status === 403 ? 'No tienes permisos para esta acción.' :
             'No se pudo crear el artículo.');
          this.toastErr(txt);
        },
      });
  }

  // ───────── edición ─────────
  startEdit(p: Post) {
    if (!this.isOwner(p)) { this.toastErr('Solo el autor puede editar.'); return; }
    this.editingId = p._id;
    this.editForm.setValue({
      title: (p.title || '').toString(),
      content: (p.content || '').toString(),
    });
  }

  cancelEdit() {
    this.editingId = null;
    this.editForm.reset({ title: '', content: '' });
  }

  saveEdit(p: Post) {
    if (!this.isOwner(p)) { this.toastErr('Solo el autor puede editar.'); return; }
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }

    const payload = {
      title: (this.editForm.value.title || '').toString(),
      content: (this.editForm.value.content || '').toString(),
    };

    this.svc.updatePost(p._id, payload).subscribe({
      next: (updated) => {
        // actualizar tarjeta local
        p.title = updated?.title ?? payload.title;
        p.content = updated?.content ?? payload.content;
        this.toastOk('Artículo actualizado.');
        this.cancelEdit();
      },
      error: (e) => {
        const m = e?.error?.message;
        this.toastErr(m || (e?.status === 403 ? 'El servidor bloqueó la acción (no eres el autor).' : 'No se pudo actualizar el artículo.'));
      },
    });
  }

  // ───────── eliminar ─────────
  remove(p: Post) {
    if (!this.isOwner(p)) { this.toastErr('Solo el autor puede eliminar.'); return; }
    if (this.isBrowser && !confirm(`¿Eliminar "${p.title}"?`)) return;

    this.svc.deletePost(p._id).subscribe({
      next: () => {
        this.posts = this.posts.filter(x => x._id !== p._id);
        this.toastOk('Artículo eliminado.');
        if (this.editingId === p._id) this.cancelEdit();
      },
      error: (e) => {
        const m = e?.error?.message;
        this.toastErr(m || (e?.status === 403 ? 'El servidor bloqueó la acción (no eres el autor).' : 'No se pudo eliminar el artículo.'));
      },
    });
  }
}
