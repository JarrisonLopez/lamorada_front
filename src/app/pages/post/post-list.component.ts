import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { PostService } from '../../services/post.service';

type Post = {
  _id: string;
  psychologist_id: string | { name?: string; last_name1?: string; last_name2?: string };
  title: string;
  content: string;
  active: boolean;
  created_at?: string | Date;
};

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

  constructor(
    private svc: PostService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.fetch();
  }

  fetch() {
    this.loading = true;
    this.err = null;
    this.svc.getPosts()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (res: any[]) => {
          const all = (res || []) as Post[];
          this.posts = all.filter(p => p.active !== false);
        },
        error: (e: any) => {
          console.error('GET /post failed:', e);
          this.err = e?.error?.message || e?.message || 'No se pudieron cargar los artículos.';
        },
      });
  }

  authorName(p: Post): string {
    const a = p?.psychologist_id as any;
    if (a && typeof a === 'object') {
      return [a.name, a.last_name1, a.last_name2].filter(Boolean).join(' ');
    }
    return '';
  }
}
