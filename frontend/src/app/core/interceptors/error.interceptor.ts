import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

// Module-level state so concurrent 401s queue behind a single refresh attempt
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status !== 401 ||
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/refresh')
      ) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        // Another refresh is in flight — wait for it, then retry with the new token
        return refreshTokenSubject.pipe(
          filter((token) => token !== null),
          take(1),
          switchMap((token) =>
            next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
          )
        );
      }

      isRefreshing = true;
      refreshTokenSubject.next(null);

      // Fix 3: refreshToken() sends no body — the HttpOnly cookie is sent automatically
      return authService.refreshToken().pipe(
        switchMap((res) => {
          isRefreshing = false;
          refreshTokenSubject.next(res.access_token);
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${res.access_token}` } }));
        }),
        catchError((refreshError) => {
          isRefreshing = false;
          authService.clearSessionAndRedirect();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
