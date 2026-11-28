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

export const requestAuthEmailChange = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
};

export const updateAuthPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user || userData.user.id !== userId || !userData.user.email) {
    throw new Error('No se pudo validar la sesión actual. Vuelve a iniciar sesión e inténtalo de nuevo.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: currentPassword,
  });
  if (error) {
    if (error.code === 'invalid_credentials') {
      throw new Error('La contraseña actual es incorrecta.');
    }
    throw error;
  }
  if (data.user?.id !== userId) {
    throw new Error('No se pudo verificar que la cuenta autenticada sea la misma.');
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw updateError;
};

// Iniciar sesión con email y contraseña
export const signInWithEmail = async (email: string, password: string): Promise<{ user: UserProfile | null; error?: string }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const emailNotConfirmed = error.message.toLowerCase().includes('email not confirmed');
      return {
        user: null,
        error: emailNotConfirmed
          ? 'Primero verifica tu correo con el enlace que te enviamos. Después podrás iniciar sesión.'
          : error.message,
      };
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
): Promise<{
  success: boolean;
  error?: string;
  emailVerificationRequired?: boolean;
  emailRateLimited?: boolean;
}> => {
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
      const emailRateLimited = error.status === 429
        || error.code === 'over_email_send_rate_limit'
        || error.message.toLowerCase().includes('email rate limit exceeded');
      return {
        success: false,
        error: emailRateLimited
          ? 'Supabase limitó temporalmente el envío del correo de verificación. Espera antes de volver a intentarlo. Si ya recibiste un enlace, úsalo para verificar tu cuenta y luego inicia sesión.'
          : error.message,
        emailRateLimited,
      };
    }

    if (!data.user) return { success: false, error: 'Supabase no devolvió el usuario creado.' };
    if (data.user.identities?.length === 0) {
      return {
        success: false,
        error: 'No se pudo completar el registro. Si ya tienes una cuenta, inicia sesión o restablece tu contraseña.',
      };
    }
    return { success: true, emailVerificationRequired: !data.session };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar usuario.' };
  }
};

// Cerrar sesión
export const signOutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
