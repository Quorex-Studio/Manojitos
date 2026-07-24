import React, { useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Location, User, Wallet, Heart, ShoppingBag, Shield, Sparkles } from 'reicon-react';
import { Package, Bell, Settings, CreditCard, ChevronRight, Clock, Headphones } from 'reicon-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  to?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  description?: string;
  badge?: number | string;
  badgeVariant?: 'default' | 'secondary' | 'destructive';
  accent?: boolean;
}

const QuickLink = memo(function QuickLink({ to, onClick, icon, label, description, badge, badgeVariant = 'secondary', accent }: QuickLinkProps) {
  const content = (
    <div className={cn(
      "flex flex-col p-4 md:p-5 rounded-2xl h-full transition-all duration-300 group text-left w-full",
      "bg-card/80 hover:bg-card border border-border/40 hover:border-primary/20",
      "hover:shadow-md hover:-translate-y-0.5",
      accent && "border-primary/20 bg-primary/5"
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl bg-primary/5 text-primary/70 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
          {icon}
        </div>
        {badge !== undefined && badge !== 0 && (
          <Badge variant={badgeVariant} className="text-[10px] px-2 h-5 rounded-full shadow-sm font-medium">
            {badge}
          </Badge>
        )}
      </div>
      <div className="mt-auto">
        <h3 className="font-medium text-[15px] text-foreground mb-1 group-hover:text-primary transition-colors tracking-tight line-clamp-1">{label}</h3>
        {description && (
          <p className="text-[13px] text-muted-foreground/80 leading-snug line-clamp-2">{description}</p>
        )}
      </div>
    </div>
  );

  return (
    <motion.div variants={item} className="h-full">
      {to ? (
        <Link to={to} className="block h-full">
          {content}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className="block h-full w-full">
          {content}
        </button>
      )}
    </motion.div>
  );
});

export function CustomerDashboard() {
  const { profile, hasProfile } = useCustomerProfile();
  const { orders } = useCustomerOrders();
  const { credit, hasCredit } = useCustomerCredit();
  const { wishlist } = useWishlist();
  const { unreadCount } = useCustomerNotifications();
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const openSecurityModal = useCallback(() => setIsSecurityModalOpen(true), []);
  const openAddressModal = useCallback(() => setIsAddressModalOpen(true), []);
  const openSupportModal = useCallback(() => setIsSupportModalOpen(true), []);

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

      {/* Grid de accesos rápidos — Estilo Amazon */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <QuickLink
          to="/cliente/pedidos"
          icon={<ShoppingBag className="h-6 w-6" />}
          label="Mis Pedidos"
          description="Rastrea y gestiona tus compras"
          badge={pendingOrders > 0 ? pendingOrders : undefined}
          badgeVariant="default"
          accent={pendingOrders > 0}
        />

        <QuickLink
          icon={<Shield className="h-6 w-6" />}
          label="Inicio de sesión y seguridad"
          description="Editar nombre, teléfono y contraseña"
          onClick={openSecurityModal}
        />

        <QuickLink
          icon={<Location className="h-6 w-6" />}
          label="Tus Direcciones"
          description="Editar, eliminar o establecer predeterminada"
          onClick={openAddressModal}
        />

        <QuickLink
          to="/cliente/credito"
          icon={<Wallet className="h-6 w-6" />}
          label="Tus Pagos"
          description="Ver transacciones y administrar saldo"
          badge={hasCredit ? credit?.status : undefined}
          badgeVariant={credit?.status === 'VENCIDO' ? 'destructive' : 'secondary'}
        />

        {!hasCredit && (
          <QuickLink
            to="/cliente/credito"
            icon={<CreditCard className="h-6 w-6" />}
            label="Solicitar Crédito"
            description="Activa tu línea de crédito con la tienda"
            accent
          />
        )}

        <QuickLink
          to="/cliente/favoritos"
          icon={<Heart className="h-6 w-6" />}
          label="Lista de Deseos"
          description="Productos que te encantan"
          badge={wishlistCount > 0 ? wishlistCount : undefined}
        />

        <QuickLink
          icon={<Headphones className="h-6 w-6" />}
          label="Servicio al Cliente"
          description="Explorar opciones de ayuda o contáctanos"
          badge={unreadCount > 0 ? unreadCount : undefined}
          badgeVariant="destructive"
          onClick={openSupportModal}
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

      {/* Modal de Direcciones Estilo Amazon */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[600px] p-0 overflow-hidden rounded-2xl bg-background border border-border/40 shadow-2xl">
          <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex justify-between items-center">
            <DialogTitle className="text-xl font-medium tracking-tight">Tus direcciones</DialogTitle>
            <DialogDescription className="sr-only">Gestiona tus direcciones de envío</DialogDescription>
          </div>

          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">

            {/* Lista de direcciones guardadas (Simulado usando profile) */}
            <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 relative">
              <Badge className="absolute -top-3 -right-2 bg-primary/20 text-primary hover:bg-primary/30 border-none shadow-none">Predeterminada</Badge>
              <h3 className="font-medium text-base mb-1">{profile?.full_name || 'Tu Nombre'}</h3>
              <p className="text-sm text-muted-foreground mb-1">Edo nueva esparta, municipio gomez, la vecindad</p>
              <p className="text-sm text-muted-foreground mb-3">La Vecindad, Nueva Esparta, 6314, Venezuela</p>
              <p className="text-sm text-muted-foreground mb-4">Número de teléfono: {profile?.phone || '04123574858'}</p>
              <div className="flex gap-4 border-t border-primary/10 pt-3">
                <button className="text-sm text-primary font-medium hover:underline focus:outline-none">Editar</button>
                <button className="text-sm text-muted-foreground hover:text-destructive focus:outline-none transition-colors">Eliminar</button>
              </div>
            </div>

            {/* Agregar Nueva Dirección */}
            <div className="pt-2">
              <h4 className="text-lg font-medium mb-4 flex items-center gap-2">
                <div className="bg-primary/10 p-1.5 rounded-full"><Location className="h-4 w-4 text-primary" /></div>
                Agregar una nueva dirección
              </h4>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-foreground/80">País o región</Label>
                  <Select defaultValue="ve">
                    <SelectTrigger className="bg-muted/20 border-border/50 focus:ring-primary/20">
                      <SelectValue placeholder="Selecciona un país" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ve">Venezuela</SelectItem>
                      <SelectItem value="us">Estados Unidos</SelectItem>
                      <SelectItem value="co">Colombia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-foreground/80">Nombre completo (nombre y apellido)</Label>
                  <Input placeholder="Ej. Alex Pérez" className="bg-muted/20 border-border/50 focus:border-primary/30" />
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-foreground/80">Número de teléfono</Label>
                  <Input placeholder="+58 424 0000000" className="bg-muted/20 border-border/50 focus:border-primary/30" />
                  <p className="text-[11px] text-muted-foreground">Se puede utilizar para ayudar a la entrega</p>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-foreground/80">Dirección</Label>
                  <Input placeholder="Nombre de la calle" className="mb-2 bg-muted/20 border-border/50 focus:border-primary/30" />
                  <Input placeholder="Depto., unidad, edificio, piso, etc." className="bg-muted/20 border-border/50 focus:border-primary/30" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-semibold text-foreground/80">Ciudad</Label>
                    <Input placeholder="Ciudad" className="bg-muted/20 border-border/50 focus:border-primary/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold text-foreground/80">Estado</Label>
                    <Select>
                      <SelectTrigger className="bg-muted/20 border-border/50 focus:ring-primary/20">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ne">Nueva Esparta</SelectItem>
                        <SelectItem value="mi">Miranda</SelectItem>
                        <SelectItem value="dc">Distrito Capital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-foreground/80">Código Postal</Label>
                  <Input placeholder="Ej. 6301" className="bg-muted/20 border-border/50 focus:border-primary/30" />
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-foreground/80">Instrucción de entrega (opc.)</Label>
                  <Input placeholder="Notas, preferencias y más" className="bg-muted/20 border-border/50 focus:border-primary/30" />
                </div>

                <div className="pt-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-primary/30 text-primary focus:ring-primary/20 h-4 w-4 bg-muted/20" />
                    <span className="text-sm font-medium">Marcar como dirección preferida</span>
                  </label>
                </div>

              </div>
            </div>
          </div>

          <div className="p-4 bg-muted/20 border-t border-border/40 flex justify-end gap-3 sticky bottom-0">
            <Button variant="ghost" onClick={() => setIsAddressModalOpen(false)} className="hover:bg-muted/50">
              Cancelar
            </Button>
            <Button
              onClick={() => setIsAddressModalOpen(false)}
              className="bg-[#FFD814] hover:bg-[#F7CA00] text-black border border-[#FCD200] shadow-sm font-medium px-6"
            >
              Usar esta dirección
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal de Inicio de Sesión y Seguridad */}
      <Dialog open={isSecurityModalOpen} onOpenChange={setIsSecurityModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[450px] p-0 overflow-hidden rounded-2xl bg-background border border-border/40 shadow-2xl">
          <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-medium tracking-tight">Seguridad de la Cuenta</DialogTitle>
              <DialogDescription className="text-xs">Actualiza tus credenciales y datos básicos</DialogDescription>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="font-semibold text-foreground/80">Nombre completo</Label>
              <Input defaultValue={profile?.full_name || ''} className="bg-muted/20 focus:border-primary/30" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-foreground/80">Correo electrónico</Label>
              <Input defaultValue={profile?.email || ''} readOnly className="bg-muted/10 opacity-70 cursor-not-allowed" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-foreground/80">Contraseña actual</Label>
              <Input type="password" placeholder="••••••••" className="bg-muted/20 focus:border-primary/30" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-foreground/80">Nueva contraseña (Opcional)</Label>
              <Input type="password" placeholder="Nueva contraseña" className="bg-muted/20 focus:border-primary/30" />
            </div>
          </div>
          <div className="p-4 bg-muted/20 border-t border-border/40 flex justify-end gap-3 sticky bottom-0">
            <Button variant="ghost" onClick={() => setIsSecurityModalOpen(false)} className="hover:bg-muted/50">
              Cancelar
            </Button>
            <Button
              onClick={() => setIsSecurityModalOpen(false)}
              className="bg-[#FFD814] hover:bg-[#F7CA00] text-black border border-[#FCD200] shadow-sm font-medium px-6"
            >
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Servicio al Cliente */}
      <Dialog open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[450px] p-0 overflow-hidden rounded-2xl bg-background border border-border/40 shadow-2xl">
          <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-medium tracking-tight">Centro de Ayuda</DialogTitle>
              <DialogDescription className="text-xs">¿En qué podemos ayudarte hoy?</DialogDescription>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid gap-3">
              <button className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all text-left">
                <div>
                  <h4 className="font-medium text-sm">Problemas con un pedido</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Devoluciones, faltantes o retrasos</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all text-left">
                <div>
                  <h4 className="font-medium text-sm">Problemas con pagos</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Cargos no reconocidos, errores</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all text-left">
                <div>
                  <h4 className="font-medium text-sm">Chat en vivo</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Habla con un asesor por WhatsApp</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="p-4 bg-muted/20 border-t border-border/40 text-center sticky bottom-0">
            <Button variant="ghost" onClick={() => setIsSupportModalOpen(false)} className="w-full hover:bg-muted/50">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
