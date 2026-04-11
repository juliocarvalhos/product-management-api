export interface LoginRequest {
  email: string;
  password: string;
}

// Fix 3: refresh_token removed — it is delivered via HttpOnly cookie, not in the body
export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  role: 'leitor' | 'editor' | 'admin';
  is_active: boolean;
}
