import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Wallet, 
  Package, 
  Heart, 
  Bell, 
  Settings, 
  CreditCard,
  ChevronRight,
  ShoppingBag,
  Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { useWishlist } from '@/hooks/useWishlist';
import { useCustomerNotifications } from '@/hooks/useCustomerNotifications';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

interface QuickLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  badge?: number | string;
  badgeVariant?: 'default' | 'secondary' | 'destructive';
}

function QuickLink({ to, icon, label, description, badge, badgeVariant = 'secondary' }: QuickLinkProps) {
  return (
    <motion.div variants={item}>
      <Link to={to}>
        <Card className="glass-card hover:border-primary/50 transition-all hover:shadow-lg group">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              {icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{label}</p>
                {badge !== undefined && badge !== 0 && (
                  <Badge variant={badgeVariant} className="text-xs">
                    {badge}
                  </Badge>
                )}
              </div>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

export function CustomerDashboard() {
  const { profile, hasProfile } = useCustomerProfile();
  const { orders } = useCustomerOrders();
  const { credit, hasCredit } = useCustomerCredit();
  const { wishlist } = useWishlist();
  const { unreadCount } = useCustomerNotifications();

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const wishlistCount = wishlist.length;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* Bienvenida */}
      <motion.div variants={item} className="mb-6">
        <h2 className="text-xl font-semibold">
          {hasProfile && profile?.full_name 
            ? `Hola, ${profile.full_name.split(' ')[0]}` 
            : 'Bienvenido'}
        </h2>
        <p className="text-muted-foreground">
          Gestiona tu cuenta y revisa tus compras
        </p>
      </motion.div>

      {/* Grid de accesos rápidos */}
      <div className="grid gap-3">
        <QuickLink
          to="/cliente/perfil"
          icon={<User className="h-5 w-5" />}
          label="Mi Perfil"
          description="Datos personales y dirección"
        />

        <QuickLink
          to="/cliente/pedidos"
          icon={<Package className="h-5 w-5" />}
          label="Mis Pedidos"
          description={pendingOrders > 0 ? `${pendingOrders} en proceso` : 'Historial de compras'}
          badge={pendingOrders > 0 ? pendingOrders : undefined}
          badgeVariant="default"
        />

        <QuickLink
          to="/cliente/credito"
          icon={<Wallet className="h-5 w-5" />}
          label="Mi Crédito"
          description={hasCredit ? `Saldo: $${credit?.current_balance?.toFixed(2)}` : 'Ver estado crediticio'}
          badge={hasCredit ? credit?.status : undefined}
          badgeVariant={credit?.status === 'VENCIDO' ? 'destructive' : 'secondary'}
        />

        <QuickLink
          to="/cliente/favoritos"
          icon={<Heart className="h-5 w-5" />}
          label="Lista de Deseos"
          description={wishlistCount > 0 ? `${wishlistCount} productos guardados` : 'Productos que te gustan'}
          badge={wishlistCount > 0 ? wishlistCount : undefined}
        />

        <QuickLink
          to="/cliente/notificaciones"
          icon={<Bell className="h-5 w-5" />}
          label="Notificaciones"
          description="Avisos y recordatorios"
          badge={unreadCount > 0 ? unreadCount : undefined}
          badgeVariant="destructive"
        />

        <QuickLink
          to="/cliente/metodos-pago"
          icon={<CreditCard className="h-5 w-5" />}
          label="Métodos de Pago"
          description="Gestiona tus métodos guardados"
        />

        <QuickLink
          to="/cliente/configuracion"
          icon={<Settings className="h-5 w-5" />}
          label="Configuración"
          description="Seguridad y preferencias"
        />
      </div>

      {/* Acciones rápidas */}
      <motion.div variants={item} className="pt-4">
        <div className="grid grid-cols-2 gap-3">
          <Link to="/tienda">
            <Card className="glass-card hover:border-primary/50 transition-all cursor-pointer">
              <CardContent className="p-4 text-center">
                <ShoppingBag className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="font-medium text-sm">Ir a la Tienda</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/cliente/pedidos">
            <Card className="glass-card hover:border-primary/50 transition-all cursor-pointer">
              <CardContent className="p-4 text-center">
                <Clock className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="font-medium text-sm">Rastrear Pedido</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
