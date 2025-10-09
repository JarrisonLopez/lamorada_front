import { Routes } from '@angular/router';
import { SignInComponent } from './auth/sign-in/sign-in.component';
import { SignUpComponent } from './auth/sign-up/sign-up.component';
import { HomeComponent } from './pages/home/home.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { ProductComponent } from './pages/product/product.component';
import { CartComponent } from './pages/cart/cart.component';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { PaymentComponent } from './pages/payment/payment.component';
import { PodcastComponent } from './pages/podcast/podcast.component';
import { AuthRoleGuard } from './guards/auth-role.guard';


export const routes: Routes = [
  { 
    path: 'sign-in', 
    component: SignInComponent 
  },

  { 
    path: 'sign-up', 
    component: SignUpComponent 
  },
  {
    path: 'home',
    component: HomeComponent
  },
  { 
    path: 'profile',
    component: ProfileComponent
  },
  {
    path: 'product',
    component: ProductComponent
  },
  {
    path: 'cart',
    component: CartComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] }
  },
  {
    path: 'checkout',
    component: CheckoutComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] }
  },
  {
    path: 'payment',
    component: PaymentComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] }
  },
  {
    path: 'podcast',
    component: PodcastComponent
  },
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  }
];
