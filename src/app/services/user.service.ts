import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  // ---------- AUTH ----------
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, { email, password });
  }

  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/logout`, {}, { headers: this.getAuthHeaders() });
  }

  // ---------- USER ----------
  register(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/user/register`, data);
  }

  updateUser(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/user/${id}`, data, { headers: this.getAuthHeaders() });
  }

  getPatients(): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/get-patients`, { headers: this.getAuthHeaders() });
  }

  getPsychologists(): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/get-psychologists`);
  }

  getPsychologistsBySpecialty(specialty: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/by-specialty?specialty=${specialty}`);
  }

  deleteMe(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/user/delete-me`, { headers: this.getAuthHeaders() });
  }
}