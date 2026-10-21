import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader, Lock, Unlock, Plus, User } from 'reicon-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { isValidEmail } from '@/lib/customerAccounts';
import { cn } from '@/lib/utils';

export interface Employee {
  id: string;
  email: string;
  full_name: string;
  banned_until: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

/** Llama a la edge function admin-actions y devuelve su JSON, o lanza el motivo del error. */
async function adminAction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-actions', { body });
  if (!error && !data?.error) return data as T;
  let message = (data?.error as string | undefined) ?? '';
  const context = (error as { context?: Response } | null)?.context;
  if (!message && context && typeof context.json === 'function') {
    try { message = (await context.json())?.error ?? ''; } catch { /* respuesta sin JSON */ }
  }
  throw new Error(message || error?.message || 'No se pudo completar');
}

export const isSuspended = (e: Pick<Employee, 'banned_until'>, now = new Date()) => !!e.banned_until && new Date(e.banned_until) > now;

const DATE_FMT = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric' });
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Configuración → Empleados. Un empleado (rol «vendedor») entra por /auth y solo ve Nueva venta
 * y sus ventas del día: sin precios editables, inventario, reportes ni ajustes. No se borra
 * (sus ventas quedan a su nombre): se suspende y se reactiva.
 */
export function EmployeesSettings() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [passwordFor, setPasswordFor] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => (await adminAction<{ employees: Employee[] }>({ action: 'list_employees' })).employees,
    staleTime: 60_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['employees'] });

  const create = async () => {
    setBusy('new');
    try {
      await adminAction({ action: 'create_employee', full_name: form.full_name.trim(), email: form.email.trim().toLowerCase(), password: form.password });
      toast.success('Empleado creado', { description: `${form.full_name.trim()} ya puede entrar con ${form.email.trim()} y la contraseña que le diste.` });
      setCreating(false);
      setForm({ full_name: '', email: '', password: '' });
      refresh();
    } catch (e) {
      toast.error('No se pudo crear', { description: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (e: Employee) => {
    const suspend = !isSuspended(e);
    if (suspend && !(await confirm({
      title: `¿Suspender a ${e.full_name || e.email}?`,
      description: 'No podrá entrar ni registrar ventas hasta que lo reactives. Sus ventas se quedan como están.',
      confirmText: 'Suspender',
    }))) return;
    setBusy(e.id);
    try {
      await adminAction({ action: suspend ? 'suspend' : 'restore', userId: e.id });
      toast.success(suspend ? 'Empleado suspendido' : 'Empleado reactivado');
      refresh();
    } catch (err) {
      toast.error('No se pudo cambiar', { description: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async () => {
    if (!passwordFor) return;
    setBusy(passwordFor.id);
    try {
      await adminAction({ action: 'change_password', userId: passwordFor.id, newPassword });
      toast.success('Contraseña cambiada', { description: `Dale la nueva contraseña a ${passwordFor.full_name || passwordFor.email}.` });
      setPasswordFor(null);
      setNewPassword('');
    } catch (e) {
      toast.error('No se pudo cambiar', { description: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  const canCreate = form.full_name.trim().length > 1 && isValidEmail(form.email) && form.password.length >= 8;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Empleados</h2>
          <p className="text-sm text-muted-foreground">
            Solo facturan: registran ventas desde su teléfono y ven las suyas del día. No cambian precios ni ven inventario, reportes o ajustes.
          </p>
        </div>
        <Button className="h-11 gap-2 rounded-full" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Nuevo empleado
        </Button>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader className="h-4 w-4 animate-spin" />Cargando…</p>
      ) : error ? (
        <p className="py-6 text-sm text-sale">No se pudo cargar la lista: {errorText(error)}</p>
      ) : employees.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Aún no hay empleados.</p>
      ) : (
        <ul className="divide-y divide-border">
          {employees.map(e => {
            const suspended = isSuspended(e);
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {e.full_name || e.email}
                    {suspended && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">Suspendido</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.email} · {e.last_sign_in_at ? `entró el ${DATE_FMT.format(new Date(e.last_sign_in_at))}` : 'aún no ha entrado'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-10 rounded-full" disabled={busy === e.id} onClick={() => { setPasswordFor(e); setNewPassword(''); }}>
                    Contraseña
                  </Button>
                  <Button variant="outline" className="h-10 gap-2 rounded-full" disabled={busy === e.id} onClick={() => toggle(e)}>
                    {busy === e.id ? <Loader className="h-4 w-4 animate-spin" /> : suspended ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {suspended ? 'Reactivar' : 'Suspender'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">El empleado entra en {window.location.host}/auth con su correo y contraseña.</p>

      <Dialog open={creating} onOpenChange={o => { if (!o) setCreating(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo empleado</DialogTitle>
            <DialogDescription>Entra con este correo y la contraseña que le des. Puedes cambiarla después.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="emp-name">Nombre</Label>
              <Input id="emp-name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value.slice(0, 120) }))} className="h-11 rounded-xl" autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emp-email">Correo</Label>
              <Input id="emp-email" type="email" inputMode="email" autoComplete="off" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value.replace(/\s/g, '').slice(0, 100) }))}
                placeholder="nombre@correo.com" className={cn('h-11 rounded-xl', form.email && !isValidEmail(form.email) && 'border-sale')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emp-pass">Contraseña</Label>
              <Input id="emp-pass" type="text" autoComplete="new-password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value.slice(0, 72) }))} className="h-11 rounded-xl" />
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-full" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button className="h-11 gap-2 rounded-full" disabled={!canCreate || busy === 'new'} onClick={create}>
              {busy === 'new' ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!passwordFor} onOpenChange={o => { if (!o) setPasswordFor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva contraseña</DialogTitle>
            <DialogDescription>Para {passwordFor?.full_name || passwordFor?.email}. La anterior deja de funcionar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="emp-new-pass">Contraseña</Label>
            <Input id="emp-new-pass" type="text" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value.slice(0, 72))} className="h-11 rounded-xl" />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-full" onClick={() => setPasswordFor(null)}>Cancelar</Button>
            <Button className="h-11 rounded-full" disabled={newPassword.length < 8 || busy === passwordFor?.id} onClick={changePassword}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
