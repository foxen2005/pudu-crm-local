export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
