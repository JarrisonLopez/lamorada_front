import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app/post';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  createPost(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/create`, data, { headers: this.getAuthHeaders() });
  }

  getPosts(): Observable<any> {
    return this.http.get(this.baseUrl);
  }

  getPostById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${id}`);
  }

  updatePost(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, data, { headers: this.getAuthHeaders() });
  }

  deletePost(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`, { headers: this.getAuthHeaders() });
  }
}