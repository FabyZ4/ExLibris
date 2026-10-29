import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/store/ExLibrisContext';

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
}

export const normalizeUserRole = (role: unknown): UserRole => {
  if (typeof role !== 'string') return 'lector';

  const normalizedRole = role.trim().toLowerCase();
  return ['moderador', 'admin', 'administrador'].includes(normalizedRole)
    ? 'moderador'
    : 'lector';
};

const mapAuthenticatedUser = async (
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  fallbackEmail: string
): Promise<UserProfile> => {
  const { data: usuarioData, error: usuarioError } = await supabase
    .from('usuario')
    .select('nombre_usuario, rol(nombre_rol)')
    .eq('id_usuario', authUser.id)
    .maybeSingle();

  if (usuarioError) {
    console.warn('No se pudo cargar el perfil del usuario desde Supabase:', usuarioError);
  }

  const roleName = usuarioData?.rol &&
    typeof usuarioData.rol === 'object' &&
    'nombre_rol' in usuarioData.rol
    ? usuarioData.rol.nombre_rol
    : undefined;
  const metadataName = authUser.user_metadata?.nombre;

  return {
    id: authUser.id,
    email: authUser.email || fallbackEmail,
    nombre: usuarioData?.nombre_usuario ||
      (typeof metadataName === 'string' ? metadataName : undefined) ||
      authUser.email?.split('@')[0] ||
      fallbackEmail.split('@')[0] ||
      'Usuario',
    rol: normalizeUserRole(roleName),
  };
};

export const getAuthenticatedUserProfile = async (): Promise<UserProfile | null> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.name !== 'AuthSessionMissingError') {
      console.warn('No se pudo validar la sesión de Supabase:', error);
    }
    return null;
  }
  if (!data.user) return null;

  return mapAuthenticatedUser(data.user, data.user.email || '');
};

// Iniciar sesión con email y contraseña
export const signInWithEmail = async (email: string, password: string): Promise<{ user: UserProfile | null; error?: string }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { user: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, error: 'No se obtuvo información de usuario.' };
    }

    return {
      user: await mapAuthenticatedUser(data.user, email),
    };
  } catch (err: any) {
    return { user: null, error: err.message || 'Error de conexión con Supabase.' };
  }
};

// Registro de usuario en Supabase
export const signUpWithEmail = async (
  email: string,
  password: string,
  nombre: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) return { success: false, error: 'Supabase no devolvió el usuario creado.' };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar usuario.' };
  }
};

// Cerrar sesión
export const signOutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
