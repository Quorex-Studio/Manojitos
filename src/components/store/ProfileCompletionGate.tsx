import { Navigate, useLocation } from 'react-router-dom';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';

// Rutas por las que puede pasar mientras completa el perfil (entrar, crear contraseña, legales)
const ALLOWED = ['/cliente/perfil', '/cliente/auth', '/cliente/recuperar', '/terminos', '/privacidad'];

/**
 * Cuenta creada por la tienda (Nueva venta o Ángela): mientras el perfil esté pendiente, la clienta
 * vuelve a "Mi perfil" para completar cédula y dirección antes de seguir usando la tienda.
 */
export function ProfileCompletionGate() {
  const { pathname } = useLocation();
  const { profile } = useCustomerProfile();
  if (!profile?.profile_pending || ALLOWED.some(p => pathname.startsWith(p))) return null;
  return <Navigate to="/cliente/perfil?tab=profile&completar=1" replace />;
}
