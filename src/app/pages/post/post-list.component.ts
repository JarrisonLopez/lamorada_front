import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { PostService, Post } from '../../services/post.service';

@Component({
  standalone: true,
  selector: 'app-post-list',
  imports: [CommonModule, DatePipe],
  templateUrl: './post-list.component.html',
  styleUrls: ['./post-list.component.css'],
})
export class PostListComponent {
  loading = false;
  err: string | null = null;
  posts: Post[] = [];

  constructor(private svc: PostService, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.fetch();
  }

  fetch() {
    this.loading = true;
    this.err = null;
    this.svc.getPosts(false)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: Post[]) => {
          const all = res || [];
          this.posts = all.filter((p) => p.active !== false);
        },
        error: (e: any) => {
          this.err = e?.error?.message || e?.message || 'No se pudieron cargar los artículos.';
        },
      });
  }

  authorName(p: Post): string {
    const a: any = p?.psychologist_id;
    if (a && typeof a === 'object') {
      return [a.name, a.last_name1, a.last_name2].filter(Boolean).join(' ');
    }
    return '';
  }
}
