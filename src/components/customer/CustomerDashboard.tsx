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
        <div className={cn(
          "flex items-center gap-4 p-4 rounded-xl transition-all duration-300 group",
          "bg-card/80 hover:bg-card/80 border border-transparent hover:border-primary/10",
          "hover:shadow-[0_0_20px_hsl(var(--rose)/0.08)]",
          accent && "border-primary/10 bg-primary/5"
        )}>
          <div className="p-2.5 rounded-xl bg-primary/5 text-primary/60 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm text-foreground/80 truncate tracking-wide">{label}</p>
              {badge !== undefined && badge !== 0 && (
                <Badge variant={badgeVariant} className="text-[9px] h-4 px-1.5 leading-none rounded-full">
                  {badge}
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground/75 dark:text-muted-foreground/40 truncate tracking-wide">{description}</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary/50 transition-all group-hover:translate-x-0.5" />
        </div>
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
      className="space-y-5"
    >
      {/* Banner de recordatorio de pago */}
      <motion.div variants={item}>
        <PaymentReminderBanner />
      </motion.div>

      {/* Perfil Financiero del Cliente */}
      {hasCredit && credit && (
        <motion.div variants={item}>
          <CreditFinancialProfile creditData={credit} compact />
        </motion.div>
      )}

      {/* Bienvenida Hero — editorial con gradient sutil */}
      <motion.div 
        variants={item} 
        className="relative overflow-hidden rounded-2xl p-7 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/8"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-primary/60 mb-2.5">
            <Sparkles className="h-3.5 w-3.5 fill-primary/20" />
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase">Área Exclusiva</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground tracking-tight">
            {hasProfile && profile?.full_name 
              ? `Hola, ${profile.full_name.split(' ')[0]}` 
              : 'Bienvenido'}
          </h2>
          <p className="text-sm text-muted-foreground/75 dark:text-muted-foreground/40 max-w-[250px] tracking-wide mt-1">
            Gestiona tu cuenta y revisa tus compras en Manojitos.
          </p>
        </div>
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      </motion.div>

      {/* Grid de estadísticas — Gold numbers */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <div className="text-center p-3.5 rounded-xl bg-card/80 backdrop-blur-sm border border-gold/10">
          <p className="text-xl font-bold font-serif text-gradient-gold">{orders.length}</p>
          <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 dark:text-muted-foreground/30 mt-0.5">Pedidos</p>
        </div>
        <div className="text-center p-3.5 rounded-xl bg-card/80 backdrop-blur-sm border border-border/10">
          <p className="text-xl font-bold font-serif text-gradient-gold">{wishlistCount}</p>
          <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 dark:text-muted-foreground/30 mt-0.5">Favoritos</p>
        </div>
        <div className="text-center p-3.5 rounded-xl bg-card/80 backdrop-blur-sm border border-border/10">
          <p className="text-xl font-bold font-serif text-gradient-gold">{unreadCount}</p>
          <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 dark:text-muted-foreground/30 mt-0.5">Avisos</p>
        </div>
      </motion.div>

      {/* Grid de accesos rápidos — no rigid borders, glow on hover */}
      <div className="space-y-1">
        <QuickLink
          to="/cliente/perfil"
          icon={<User className="h-4.5 w-4.5" />}
          label="Mi Perfil"
          description="Datos personales y dirección"
        />

        <QuickLink
          to="/cliente/pedidos"
          icon={<Package className="h-4.5 w-4.5" />}
          label="Mis Pedidos"
          description={pendingOrders > 0 ? `${pendingOrders} en proceso` : 'Historial de compras'}
          badge={pendingOrders > 0 ? pendingOrders : undefined}
          badgeVariant="default"
          accent={pendingOrders > 0}
        />

        <QuickLink
          to="/cliente/credito"
          icon={<Wallet className="h-4.5 w-4.5" />}
          label="Mi Crédito"
          description={hasCredit ? `Saldo: $${credit?.current_balance?.toFixed(2)}` : 'Ver estado crediticio'}
          badge={hasCredit ? credit?.status : undefined}
          badgeVariant={credit?.status === 'VENCIDO' ? 'destructive' : 'secondary'}
        />

        <QuickLink
          to="/cliente/favoritos"
          icon={<Heart className="h-4.5 w-4.5" />}
          label="Lista de Deseos"
          description={wishlistCount > 0 ? `${wishlistCount} productos guardados` : 'Productos que te gustan'}
          badge={wishlistCount > 0 ? wishlistCount : undefined}
        />

        <QuickLink
          to="/cliente/notificaciones"
          icon={<Bell className="h-4.5 w-4.5" />}
          label="Notificaciones"
          description="Avisos y recordatorios"
          badge={unreadCount > 0 ? unreadCount : undefined}
          badgeVariant="destructive"
          accent={unreadCount > 0}
        />

        <QuickLink
          to="/cliente/metodos-pago"
          icon={<CreditCard className="h-4.5 w-4.5" />}
          label="Métodos de Pago"
          description="Gestiona tus métodos guardados"
        />

        <QuickLink
          to="/cliente/configuracion"
          icon={<Settings className="h-4.5 w-4.5" />}
          label="Configuración"
          description="Seguridad y preferencias"
        />
      </div>

      {/* Acciones rápidas — styled pills */}
      <motion.div variants={item} className="pt-2">
        <div className="grid grid-cols-2 gap-3">
          <Link to="/tienda">
            <div className="p-5 rounded-xl bg-card/80 border border-border/10 hover:border-primary/15 hover:bg-card/80 transition-all duration-300 cursor-pointer group text-center">
              <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-300">
                <ShoppingBag className="h-5 w-5 text-primary/60" />
              </div>
              <p className="font-medium text-xs tracking-[0.1em] uppercase text-foreground/60">Ir a la Tienda</p>
            </div>
          </Link>
          <Link to="/cliente/pedidos">
            <div className="p-5 rounded-xl bg-card/80 border border-border/10 hover:border-gold/15 hover:bg-card/80 transition-all duration-300 cursor-pointer group text-center">
              <div className="w-12 h-12 bg-gold/5 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:bg-gold/10 transition-all duration-300">
                <Clock className="h-5 w-5 text-gold/60" />
              </div>
              <p className="font-medium text-xs tracking-[0.1em] uppercase text-foreground/60">Rastrear Pedido</p>
            </div>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
