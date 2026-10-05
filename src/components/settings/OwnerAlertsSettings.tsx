import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader, Notification } from 'reicon-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PhoneInput } from '@/components/ui/ve-inputs';
import { toWhatsAppPhone } from '@/lib/venezuela';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const RULE_KEY = 'owner_alerts';

interface OwnerAlerts {
  enabled: boolean;
  whatsapp_phone: string;
  callmebot_apikey: string;
}

const EMPTY: OwnerAlerts = { enabled: false, whatsapp_phone: '', callmebot_apikey: '' };

/**
 * Configuración → Preferencias: avisos a la dueña por WhatsApp (CallMeBot).
 * Cada venta del panel y cada pedido de la tienda le llega también por WhatsApp; el correo sale siempre.
 * Se guarda en business_rules (solo administración la lee); la edge function send-email la usa.
 */
export function OwnerAlertsSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: stored, isLoading } = useQuery({
    queryKey: ['business-rule', RULE_KEY],
    queryFn: async () => {
      const { data, error } = await supabase.from('business_rules').select('id, conditions').eq('rule_key', RULE_KEY).maybeSingle();
      if (error) throw error;
      return { id: data?.id ?? null, value: { ...EMPTY, ...((data?.conditions ?? {}) as Partial<OwnerAlerts>) } };
    },
  });
  const [form, setForm] = useState<OwnerAlerts>(EMPTY);
  useEffect(() => { if (stored) setForm(stored.value); }, [stored]);

  const waPhone = toWhatsAppPhone(form.whatsapp_phone);
  const complete = waPhone.length >= 12 && form.callmebot_apikey.trim().length > 3;

  const save = useMutation({
    mutationFn: async (value: OwnerAlerts) => {
      if (!user) throw new Error('Sesión no válida');
      // CallMeBot exige 58 + número sin el 0 (nunca 0414…)
      const phone = toWhatsAppPhone(value.whatsapp_phone);
      const conditions = { ...value, whatsapp_phone: phone ? `+${phone}` : '', callmebot_apikey: value.callmebot_apikey.trim() };
      const { error } = stored?.id
        ? await supabase.from('business_rules').update({ conditions }).eq('id', stored.id)
        : await supabase.from('business_rules').insert({
            user_id: user.id, rule_key: RULE_KEY, rule_name: 'Avisos a la dueña', rule_type: 'notification',
            description: 'WhatsApp de cada venta y pedido nuevo (CallMeBot)', conditions, actions: {}, is_active: true, priority: 0,
          });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['business-rule', RULE_KEY] }); toast({ title: 'Avisos guardados' }); },
    onError: (e: Error) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' }),
  });

  const test = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { action: 'owner_whatsapp_test', data: { whatsapp_phone: `+${toWhatsAppPhone(form.whatsapp_phone)}`, callmebot_apikey: form.callmebot_apikey.trim() } },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'CallMeBot no aceptó el mensaje');
    },
    onSuccess: () => toast({ title: 'Mensaje de prueba enviado', description: 'Revisa tu WhatsApp; puede tardar un minuto.' }),
    onError: (e: Error) => toast({ title: 'No llegó la prueba', description: e.message, variant: 'destructive' }),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5"><Notification /></span>
        <div className="min-w-0">
          <h2 className="font-serif text-xl">Avisos de ventas por WhatsApp</h2>
          <p className="text-sm text-muted-foreground">Cada venta y cada pedido de la tienda te llega por correo. Actívalo aquí para recibirlo también en tu WhatsApp.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 rounded-2xl bg-studio p-4 pl-8 text-sm text-muted-foreground">
            <li>Guarda en tus contactos el número de CallMeBot que aparece en <a className="font-medium text-primary underline" href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer">callmebot.com</a>.</li>
            <li>Desde tu WhatsApp envíale: <span className="font-medium text-foreground">I allow callmebot to send me messages</span></li>
            <li>Te responde con tu clave (apikey). Escríbela abajo con tu número y toca «Enviar prueba».</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="oa-phone">Tu WhatsApp</Label>
              <PhoneInput id="oa-phone" value={form.whatsapp_phone} onChange={v => setForm(f => ({ ...f, whatsapp_phone: v }))} inputClassName="h-11 rounded-xl" />
              {waPhone.length >= 12 && <p className="text-xs text-muted-foreground">Se envía como +{waPhone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oa-key">Clave de CallMeBot</Label>
              <Input id="oa-key" value={form.callmebot_apikey} inputMode="numeric" autoComplete="off"
                onChange={e => setForm(f => ({ ...f, callmebot_apikey: e.target.value.slice(0, 40) }))} className="h-11 rounded-xl" placeholder="Ej. 1234567" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-studio p-4">
            <div>
              <p className="font-medium">Enviar avisos por WhatsApp</p>
              <p className="text-sm text-muted-foreground">{complete ? 'Ventas del panel y pedidos de la tienda.' : 'Primero escribe tu número y la clave.'}</p>
            </div>
            <Switch checked={form.enabled} disabled={!complete} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} aria-label="Enviar avisos por WhatsApp" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-11 rounded-full" disabled={!complete || test.isPending} onClick={() => test.mutate()}>
              {test.isPending && <Loader className="h-4 w-4 animate-spin" />}Enviar prueba
            </Button>
            <Button className="h-11 rounded-full" disabled={save.isPending || (form.enabled && !complete)} onClick={() => save.mutate(form)}>
              {save.isPending && <Loader className="h-4 w-4 animate-spin" />}Guardar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
