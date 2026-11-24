export type UserRole = 'lector' | 'moderador';

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
}
