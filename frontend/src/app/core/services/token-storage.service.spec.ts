import { TestBed } from '@angular/core/testing';

import { TokenStorageService } from './token-storage.service';

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenStorageService);
    service.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null before any token is set', () => {
    expect(service.getAccessToken()).toBeNull();
  });

  it('should return false for isLoggedIn before setting token', () => {
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('should store and retrieve an access token', () => {
    service.setAccessToken('test-token-123');
    expect(service.getAccessToken()).toBe('test-token-123');
  });

  it('should return true for isLoggedIn after setting token', () => {
    service.setAccessToken('test-token-123');
    expect(service.isLoggedIn()).toBeTrue();
  });

  it('should clear the token and return to unauthenticated state', () => {
    service.setAccessToken('test-token-123');
    service.clear();

    expect(service.getAccessToken()).toBeNull();
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('should overwrite an existing token with a new one', () => {
    service.setAccessToken('old-token');
    service.setAccessToken('new-token');

    expect(service.getAccessToken()).toBe('new-token');
  });

  it('should NOT write the access token to localStorage (XSS protection)', () => {
    const setSpy = spyOn(localStorage, 'setItem');
    service.setAccessToken('secret-token');
    expect(setSpy).not.toHaveBeenCalled();
  });
});
