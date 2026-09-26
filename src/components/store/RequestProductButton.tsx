import { useState } from 'react';
import { Check, Heart, Loader } from 'reicon-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PhoneInput } from '@/components/ui/ve-inputs';
import { useAuth } from '@/hooks/useAuth';
import { useRequestProduct } from '@/hooks/useProductRequests';

const storageKey = (id: string) => `product-request:${id}`;
const remembered = (id: string) => {
  try { return localStorage.getItem(storageKey(id)) === '1'; } catch { return false; }
};
const remember = (id: string) => {
  try { localStorage.setItem(storageKey(id), '1'); } catch { /* sin almacenamiento: no pasa nada */ }
};

/**
 * Producto agotado: "Lo quiero". Con cuenta se pide con un toque (y le llega el aviso cuando vuelva);
 * sin cuenta deja nombre y teléfono para que la tienda le escriba.
 */
export function RequestProductButton({ productId, productName }: { productId: string; productName: string }) {
  const { user } = useAuth();
  const request = useRequestProduct();
  const [done, setDone] = useState(() => remembered(productId));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  const submit = (input: { name?: string; phone?: string; note?: string }) =>
    request.mutate({ productId, ...input }, {
      onSuccess: res => {
        setDone(true);
        setOpen(false);
        remember(productId);
        toast.success(res.already ? 'Ya lo tenías pedido' : '¡Listo! Le avisamos a la tienda', {
          description: user ? 'Te avisaremos por aquí y por correo apenas vuelva.' : 'Te escribiremos por WhatsApp cuando vuelva.',
        });
      },
      onError: (e: Error) => toast.error('No se pudo enviar', { description: e.message }),
    });

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="font-medium text-foreground">Lo tienes pedido</p>
          <p className="text-sm text-muted-foreground">Te avisaremos apenas vuelva «{productName}».</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Button size="lg" className="h-14 w-full rounded-full text-base font-semibold" disabled={request.isPending}
          onClick={() => (user ? submit({}) : setOpen(true))}>
          {request.isPending ? <Loader className="mr-2 h-5 w-5 animate-spin" /> : <Heart className="mr-2 h-5 w-5" />}
          Lo quiero · avísame cuando llegue
        </Button>
        <p className="text-center text-sm text-muted-foreground">Está agotado. Si lo pides, la tienda sabe que lo quieres y te avisa al reponerlo.</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="font-serif text-2xl">¿Te avisamos cuando llegue?</DialogTitle>
            <DialogDescription>Déjanos tu nombre y tu WhatsApp para escribirte cuando vuelva «{productName}».</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); submit({ name: name.trim(), phone, note: note.trim() || undefined }); }}>
            <div className="space-y-1.5">
              <Label htmlFor="rq-name">Tu nombre</Label>
              <Input id="rq-name" value={name} onChange={e => setName(e.target.value.slice(0, 80))} className="h-11 rounded-xl" autoComplete="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rq-phone">Tu WhatsApp</Label>
              <PhoneInput id="rq-phone" value={phone} onChange={setPhone} inputClassName="h-11 rounded-xl" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rq-note">¿Algún detalle? (opcional)</Label>
              <Textarea id="rq-note" value={note} onChange={e => setNote(e.target.value.slice(0, 200))} rows={2} placeholder="Ej. tono, talla o cuántos quieres" className="rounded-xl" />
            </div>
            <DialogFooter className="flex-col gap-2 pt-1 sm:flex-row">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="rounded-full" disabled={request.isPending || !name.trim() || phone.length < 12}>
                {request.isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}Avísenme
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
