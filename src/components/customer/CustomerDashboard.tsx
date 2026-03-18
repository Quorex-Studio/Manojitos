import React from 'react';
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
  Clock,
  Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PaymentReminderBanner } from '@/components/customer/PaymentReminderBanner';
import { CreditFinancialProfile } from '@/components/credits/CreditFinancialProfile';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { useWishlist } from '@/hooks/useWishlist';
import { useCustomerNotifications } from '@/hooks/useCustomerNotifications';
import { cn } from '@/lib/utils';

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
  accent?: boolean;
}

function QuickLink({ to, icon, label, description, badge, badgeVariant = 'secondary', accent }: QuickLinkProps) {
  return (
    <motion.div variants={item}>
      <Link to={to}>
        <Card className={cn(
          "glass-card hover:border-primary/50 transition-all hover:shadow-lg group overflow-hidden",
          accent && "border-primary/20 bg-primary/5"
        )}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{label}</p>
                {badge !== undefined && badge !== 0 && (
                  <Badge variant={badgeVariant} className="text-[10px] h-4 px-1.5 leading-none">
                    {badge}
                  </Badge>
                )}
              </div>
              {description && (
                <p className="text-xs text-muted-foreground truncate">{description}</p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5" />
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
      {/* Banner de recordatorio de pago */}
      <motion.div variants={item}>
        <PaymentReminderBanner />
      </motion.div>

      {/* Perfil Financiero del Cliente */}
      {hasCredit && credit && (
        <motion.div variants={item}>
          <CreditFinancialProfile creditId={credit.id} compact />
        </motion.div>
      )}

      {/* Bienvenida Hero */}
      <motion.div 
        variants={item} 
        className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/10"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Sparkles className="h-4 w-4 fill-primary/20" />
            <span className="text-xs font-bold tracking-wider uppercase">Área Exclusiva</span>
          </div>
          <h2 className="text-2xl font-bold font-serif mb-1">
            {hasProfile && profile?.full_name 
              ? `Hola, ${profile.full_name.split(' ')[0]}` 
              : 'Bienvenido'}
          </h2>
          <p className="text-sm text-muted-foreground max-w-[200px]">
            Gestiona tu cuenta y revisa tus compras en Manojitos.
          </p>
        </div>
        {/* Decoración geométrica sutil */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      </motion.div>

      {/* Grid de estadísticas rápidas */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <Card className="glass-card-gold text-center p-3 border-gold/20">
          <p className="text-xl font-bold text-gold">{orders.length}</p>
          <p className="text-[10px] uppercase tracking-tighter text-muted-foreground">Pedidos</p>
        </Card>
        <Card className="glass-card text-center p-3">
          <p className="text-xl font-bold text-gold">{wishlistCount}</p>
          <p className="text-[10px] uppercase tracking-tighter text-muted-foreground">Favoritos</p>
        </Card>
        <Card className="glass-card text-center p-3">
          <p className="text-xl font-bold text-gold">{unreadCount}</p>
          <p className="text-[10px] uppercase tracking-tighter text-muted-foreground">Avisos</p>
        </Card>
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
          accent={pendingOrders > 0}
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
          accent={unreadCount > 0}
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

      {/* Acciones rápidas mejoradas */}
      <motion.div variants={item} className="pt-2">
        <div className="grid grid-cols-2 gap-3">
          <Link to="/tienda">
            <Card className="glass-card hover:border-primary/50 transition-all cursor-pointer group">
              <CardContent className="p-4 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <p className="font-bold text-xs uppercase tracking-wider">Ir a la Tienda</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/cliente/pedidos">
            <Card className="glass-card hover:border-primary/50 transition-all cursor-pointer group">
              <CardContent className="p-4 text-center">
                <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Clock className="h-6 w-6 text-gold" />
                </div>
                <p className="font-bold text-xs uppercase tracking-wider">Rastrear Pedido</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
