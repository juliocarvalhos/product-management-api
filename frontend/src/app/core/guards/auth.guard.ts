import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  // Fix 3: access token lives in memory — lost on page reload.
  // Try to restore the session silently using the HttpOnly refresh cookie.
  // If the cookie is valid, a new access token is returned and the user stays logged in.
  try {
    await firstValueFrom(auth.tryRestoreSession());
    return true;
  } catch {
    return router.createUrlTree(['/auth/login']);
  }
};
