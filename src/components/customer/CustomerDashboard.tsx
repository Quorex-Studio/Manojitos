import { BRAND_NAME } from '@/config/brand';
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
    <div className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50">
      <span className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
        accent ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
      )}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-foreground">{label}</span>
        {description && <span className="block text-[13px] leading-snug text-muted-foreground">{description}</span>}
      </span>
      {badge !== undefined && badge !== 0 && (
        <Badge variant={badgeVariant} className="h-5 shrink-0 rounded-full px-2 text-[10px] font-medium">{badge}</Badge>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </div>
  );

  return to ? (
    <Link to={to} className="block">{content}</Link>
  ) : (
    <button type="button" onClick={onClick} className="block w-full">{content}</button>
  );
});

function LinkGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section variants={item}>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">{children}</div>
    </motion.section>
  );
}

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

      {/* Resumen: toca para ir a cada sección */}
      <motion.div variants={item} className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card">
        {([
          ['/cliente/pedidos', orders.length, 'Pedidos'],
          ['/cliente/favoritos', wishlistCount, 'Favoritos'],
          ['/cliente/notificaciones', unreadCount, 'Avisos'],
        ] as [string, number, string][]).map(([to, value, label]) => (
          <Link key={label} to={to} className="px-2 py-4 text-center transition-colors first:rounded-l-2xl last:rounded-r-2xl hover:bg-muted/50">
            <p className="font-serif text-2xl font-semibold tabular-nums text-primary">{value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          </Link>
        ))}
      </motion.div>

      <LinkGroup title="Compras">
        <QuickLink
          to="/cliente/pedidos"
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Mis pedidos"
          description={pendingOrders > 0 ? `${pendingOrders} en curso · sigue su estado` : 'Estado, seguimiento y recibos'}
          badge={pendingOrders > 0 ? pendingOrders : undefined}
          badgeVariant="default"
        />
        <QuickLink
          to="/cliente/favoritos"
          icon={<Heart className="h-5 w-5" />}
          label="Lista de deseos"
          description="Lo que guardaste para después"
          badge={wishlistCount > 0 ? wishlistCount : undefined}
        />
        {hasCredit ? (
          <QuickLink
            to="/cliente/credito"
            icon={<Wallet className="h-5 w-5" />}
            label="Mi crédito"
            description="Saldo, cuotas y reportar pagos"
            badge={credit?.status}
            badgeVariant={credit?.status === 'VENCIDO' ? 'destructive' : 'secondary'}
          />
        ) : (
          <QuickLink
            to="/cliente/credito"
            icon={<CreditCard className="h-5 w-5" />}
            label="Solicitar crédito"
            description="Compra ahora y paga después"
            accent
          />
        )}
      </LinkGroup>

      <LinkGroup title="Mi cuenta">
        <QuickLink
          icon={<Shield className="h-5 w-5" />}
          label="Datos y seguridad"
          description="Nombre, teléfono y contraseña"
          onClick={openSecurityModal}
        />
        <QuickLink
          icon={<Location className="h-5 w-5" />}
          label="Direcciones"
          description="Dónde te enviamos tus pedidos"
          onClick={openAddressModal}
        />
        <QuickLink
          to="/cliente/metodos-pago"
          icon={<CreditCard className="h-5 w-5" />}
          label="Métodos de pago"
          description="Tus datos para pagar más rápido"
        />
        <QuickLink
          to="/cliente/configuracion"
          icon={<Settings className="h-5 w-5" />}
          label="Configuración"
          description="Moneda, avisos y contraseña"
        />
      </LinkGroup>

      <LinkGroup title="Ayuda">
        <QuickLink
          icon={<Headphones className="h-5 w-5" />}
          label="Atención al cliente"
          description="Escríbenos, te respondemos rápido"
          badge={unreadCount > 0 ? unreadCount : undefined}
          badgeVariant="destructive"
          onClick={openSupportModal}
        />
      </LinkGroup>

      {/* Modal de Direcciones Estilo Amazon */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="flex flex-col max-h-[85vh] sm:max-w-[600px] p-0 overflow-hidden rounded-2xl bg-background border border-border/40 shadow-2xl">
          <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex justify-between items-center shrink-0">
            <DialogTitle className="text-xl font-medium tracking-tight">Tus direcciones</DialogTitle>
            <DialogDescription className="sr-only">Gestiona tus direcciones de envío</DialogDescription>
          </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-6">

            {/* Lista de direcciones guardadas (Simulado usando profile) */}
            <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 relative">
              <Badge className="absolute -top-3 -right-2 bg-primary/20 text-primary hover:bg-primary/30 border-none shadow-none">Predeterminada</Badge>
              <h3 className="font-medium text-base mb-1">{profile?.full_name || 'Tu Nombre'}</h3>
              <p className="text-sm text-muted-foreground mb-1">{profile?.address || 'Aún no has guardado una dirección'}</p>
              <p className="text-sm text-muted-foreground mb-3">{[profile?.city, profile?.state].filter(Boolean).join(', ') || '—'}</p>
              <p className="text-sm text-muted-foreground mb-4">Número de teléfono: {profile?.phone || '—'}</p>
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

          <div className="p-4 bg-background border-t border-border/40 flex justify-end gap-3 shrink-0">
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
        <DialogContent className="flex flex-col max-h-[85vh] sm:max-w-[450px] p-0 overflow-hidden rounded-2xl bg-background border border-border/40 shadow-2xl">
          <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex items-center gap-3 shrink-0">
            <div className="bg-primary/10 p-2 rounded-full">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-medium tracking-tight">Seguridad de la Cuenta</DialogTitle>
              <DialogDescription className="text-xs">Actualiza tus credenciales y datos básicos</DialogDescription>
            </div>
          </div>
          <div className="p-6 flex-1 overflow-y-auto space-y-5">
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
          <div className="p-4 bg-background border-t border-border/40 flex justify-end gap-3 shrink-0">
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
        <DialogContent className="flex flex-col max-h-[85vh] sm:max-w-[450px] p-0 overflow-hidden rounded-2xl bg-background border border-border/40 shadow-2xl">
          <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex items-center gap-3 shrink-0">
            <div className="bg-primary/10 p-2 rounded-full">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-medium tracking-tight">Centro de Ayuda</DialogTitle>
              <DialogDescription className="text-xs">¿En qué podemos ayudarte hoy?</DialogDescription>
            </div>
          </div>
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
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
          <div className="p-4 bg-background border-t border-border/40 text-center shrink-0">
            <Button variant="ghost" onClick={() => setIsSupportModalOpen(false)} className="w-full hover:bg-muted/50">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
