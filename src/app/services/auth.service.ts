import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap, throwError } from 'rxjs';
import { API_BASE_URL, AUTH_STORAGE } from '../core/api.config';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  tier: string;
  points: number;
}

export interface RegisterRequest {
  name: string;
  phone: string;
  pin: string;
  confirmPin: string;
  email?: string;
}

export interface ChangePinRequest {
  userId: string;
  currentPin: string;
  newPin: string;
  confirmPin: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface MockAccount extends AuthUser {
  pin: string;
  phoneDigits: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private token: string | null = null;
  private user: AuthUser | null = null;
  private freshLogin = false;
  lastLoginUsedMock = false;

  private readonly mockAccounts: MockAccount[] = [
    {
      id: 'user_1',
      name: 'Alex Tan',
      phone: '+65 9123 4567',
      phoneDigits: '91234567',
      pin: '123456',
      tier: 'Gold Tier',
      points: 3820,
    },
    {
      id: 'user_3',
      name: 'Cheng Wen Mao',
      phone: '+65 8068 0505',
      phoneDigits: '80680505',
      pin: '123456',
      tier: 'Bronze Tier',
      points: 890,
    },
  ];

  constructor(private http: HttpClient) {
    this.restoreSession();
  }

  login(phone: string, pin: string): Observable<LoginResponse> {
    this.lastLoginUsedMock = false;
    const phoneDigits = phone.replace(/\D/g, '').slice(-8);

    return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, { phone: phoneDigits, pin }).pipe(
      tap((response) => this.setSession(response.token, response.user)),
      catchError((err) => {
        const mockResponse = this.tryMockLogin(phone, pin);
        if (mockResponse) {
          this.lastLoginUsedMock = true;
          this.setSession(mockResponse.token, mockResponse.user);
          return of(mockResponse);
        }

        return throwError(() => err);
      })
    );
  }

  register(payload: RegisterRequest): Observable<LoginResponse> {
    this.lastLoginUsedMock = false;

    return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/register`, payload).pipe(
      tap((response) => this.setSession(response.token, response.user))
    );
  }

  changePin(payload: ChangePinRequest): Observable<{ success: boolean; message: string }> {
    if (this.lastLoginUsedMock) {
      return this.changePinForMockUser(payload);
    }

    return this.http.post<{ success: boolean; message: string }>(
      `${API_BASE_URL}/auth/change-pin`,
      payload
    );
  }

  logout(): void {
    const userId = this.user?.id;
  
    if (userId) {
      localStorage.removeItem(
        `nets_selected_card_id_${userId}`
      );
  
      localStorage.removeItem(
        `nets_current_sgd_balance_${userId}`
      );
    }
  
    // Remove obsolete shared values from older versions
    localStorage.removeItem('nets_selected_card_id');
    localStorage.removeItem('nets_current_sgd_balance');
  
    this.token = null;
    this.user = null;
    this.lastLoginUsedMock = false;
  
    sessionStorage.removeItem(AUTH_STORAGE.token);
    sessionStorage.removeItem(AUTH_STORAGE.user);
  }

  isLoggedIn(): boolean {
    return Boolean(this.token && this.user);
  }

  get userId(): string | null {
    return this.user?.id ?? null;
  }

  get currentUser(): AuthUser | null {
    return this.user;
  }

  get authToken(): string | null {
    return this.token;
  }

  /** True once after login; cleared on first read (used to show login notifications). */
  consumeFreshLogin(): boolean {
    const value = this.freshLogin;
    this.freshLogin = false;
    return value;
  }

  getInitials(name = this.user?.name): string {
    if (!name) {
      return '';
    }
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private changePinForMockUser(
    payload: ChangePinRequest
  ): Observable<{ success: boolean; message: string }> {
    const account = this.mockAccounts.find((item) => item.id === payload.userId);
    if (!account) {
      return throwError(() => ({ error: { error: 'User not found.' } }));
    }

    if (account.pin !== payload.currentPin) {
      return throwError(() => ({ error: { error: 'Current PIN is incorrect.' } }));
    }

    if (!/^\d{6}$/.test(payload.newPin)) {
      return throwError(() => ({ error: { error: 'New PIN must be exactly 6 digits.' } }));
    }

    if (payload.newPin !== payload.confirmPin) {
      return throwError(() => ({ error: { error: 'New PIN and confirmation do not match.' } }));
    }

    if (payload.newPin === payload.currentPin) {
      return throwError(() => ({ error: { error: 'Choose a different PIN from your current one.' } }));
    }

    account.pin = payload.newPin;
    return of({ success: true, message: 'PIN updated successfully.' });
  }

  private tryMockLogin(phone: string, pin: string): LoginResponse | null {
    const digits = phone.replace(/\D/g, '').slice(-8);
    const account = this.mockAccounts.find(
      (item) => item.phoneDigits.slice(-8) === digits && item.pin === String(pin)
    );

    if (!account) {
      return null;
    }

    return {
      token: `mock-${account.id}-${Date.now()}`,
      user: {
        id: account.id,
        name: account.name,
        phone: account.phone,
        tier: account.tier,
        points: account.points,
      },
    };
  }

  private setSession(token: string, user: AuthUser): void {
    this.token = token;
    this.user = user;
    this.freshLogin = true;
    sessionStorage.setItem(AUTH_STORAGE.token, token);
    sessionStorage.setItem(AUTH_STORAGE.user, JSON.stringify(user));
  }

  private restoreSession(): void {
    const token = sessionStorage.getItem(AUTH_STORAGE.token);
    const userJson = sessionStorage.getItem(AUTH_STORAGE.user);
    if (!token || !userJson) {
      return;
    }

    try {
      this.token = token;
      this.user = JSON.parse(userJson) as AuthUser;
      this.lastLoginUsedMock = token.startsWith('mock-');
    } catch {
      this.logout();
    }
  }
}
