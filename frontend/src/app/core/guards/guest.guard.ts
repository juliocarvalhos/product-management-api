import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    // Try to restore from cookie first — if the user has a valid session,
    // don't show the login page.
    try {
      await firstValueFrom(auth.tryRestoreSession());
      return router.createUrlTree(['/products']);
    } catch {
      return true; // no valid session, stay on login page
    }
  }

  return router.createUrlTree(['/products']);
};
