import { Routes } from '@angular/router';

import { SignInComponent } from './auth/sign-in/sign-in.component';
import { SignUpComponent } from './auth/sign-up/sign-up.component';

import { HomeComponent } from './pages/home/home.component';
import { ProductComponent } from './pages/product/product.component';
import { CartComponent } from './pages/cart/cart.component';
import { AppointmentComponent } from './pages/appointment/appointment.component';

import { AvailabilityViewComponent } from './pages/availability/availability.component';
import { AvailabilityManageComponent } from './pages/availability/availability-manage.component';

import { PodcastComponent } from './pages/podcast/podcast.component';

// Posts (lista pública y gestión para psicólogo)
import { PostListComponent } from './pages/post/post-list.component';
import { PostManageComponent } from './pages/post/post-manage.component';

import { AuthRoleGuard } from './guards/auth-role.guard';

export const routes: Routes = [
  // Auth
  { path: 'sign-in', component: SignInComponent },
  { path: 'sign-up', component: SignUpComponent },

  // Públicas
  { path: 'home', component: HomeComponent },
  { path: 'product', component: ProductComponent },
  { path: 'podcast', component: PodcastComponent },
  { path: 'post', component: PostListComponent },
  { path: 'availability', component: AvailabilityViewComponent }, // vista pública

  // Protegidas (requieren login)
  {
    path: 'cart',
    component: CartComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] },
  },
  {
    path: 'appointment',
    component: AppointmentComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] },
  },
  {
    path: 'availability/manage',
    component: AvailabilityManageComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['psychologist'] },
  },
  {
    path: 'post/manage',
    component: PostManageComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['psychologist'] },
  },

  // Root & wildcard
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
