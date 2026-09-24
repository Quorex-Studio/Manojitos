import { useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Heart } from 'reicon-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useWishlist } from '@/hooks/useWishlist';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  productId: string;
  productName: string;
  className?: string;
  /** 'overlay' sobre la foto (tarjeta) o 'outline' junto al botón principal (ficha) */
  variant?: 'overlay' | 'outline';
}

// Corazón de favoritos. Sin sesión, invita a entrar y vuelve a la misma página.
export function FavoriteButton({ productId, productName, className, variant = 'overlay' }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const active = !!user && isInWishlist(productId);
  const busy = addToWishlist.isPending || removeFromWishlist.isPending;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast('Guarda tus favoritos', {
        description: 'Inicia sesión para guardar productos y verlos desde cualquier dispositivo.',
        action: {
          label: 'Entrar',
          onClick: () => navigate(`/cliente/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`),
        },
      });
      return;
    }
    if (!busy) toggleWishlist(productId);
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={reduceMotion ? undefined : { scale: 0.85 }}
      aria-pressed={active}
      aria-label={active ? `Quitar ${productName} de favoritos` : `Guardar ${productName} en favoritos`}
      title={active ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      className={cn(
        'flex items-center justify-center rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        variant === 'overlay'
          ? 'h-11 w-11 bg-background/95 shadow-sm hover:bg-background'
          : 'h-14 w-14 shrink-0 border border-border bg-card hover:border-primary',
        active ? 'text-primary' : 'text-foreground',
        className
      )}
    >
      <Heart className="h-5 w-5" weight={active ? 'Filled' : 'Outline'} />
    </motion.button>
  );
}
