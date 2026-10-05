import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Loader, Trash2 } from 'reicon-react';
import { BRAND } from '@/config/brand';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MemoryItem {
  id: string;
  kind: 'dato' | 'preferencia' | 'recordatorio';
  content: string;
  remind_on: string | null;
  done: boolean;
  created_at: string;
}

const KIND_LABEL: Record<MemoryItem['kind'], string> = { dato: 'Dato', preferencia: 'Preferencia', recordatorio: 'Recordatorio' };

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });

export const assistantMemoryKey = (userId?: string) => ['assistant-memories', userId ?? ''];

/**
 * Lo que la asistente recuerda de quien la usa (tabla assistant_memories, cada persona ve y
 * borra solo lo suyo). "Borrar todo" también limpia la conversación guardada y lo que la
 * asistente anotó de lo que vio y preguntó (customer_memory).
 */
export function AssistantMemoryCard({ className }: { className?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const name = BRAND.assistantName;

  const { data: items = [], isLoading } = useQuery({
    queryKey: assistantMemoryKey(user?.id),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assistant_memories')
        .select('id, kind, content, remind_on, done, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MemoryItem[];
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: assistantMemoryKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ['assistant-conversation', user?.id ?? ''] });
  };

  const removeOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assistant_memories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast({ title: 'No se pudo borrar', description: 'Revisa tu conexión e inténtalo de nuevo.', variant: 'destructive' }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const results = await Promise.all([
        supabase.from('assistant_memories').delete().eq('user_id', user.id),
        supabase.from('assistant_conversations').delete().eq('user_id', user.id),
        supabase.from('customer_memory').delete().eq('customer_user_id', user.id),
      ]);
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Listo', description: `${name} empezará de cero contigo.` });
    },
    onError: () => toast({ title: 'No se pudo borrar todo', description: 'Inténtalo de nuevo en un momento.', variant: 'destructive' }),
  });

  const askClearAll = async () => {
    const ok = await confirm({
      title: `¿Borrar todo lo que ${name} recuerda?`,
      description: 'Se borran tus datos y preferencias guardados, los recordatorios y la conversación. No se puede deshacer.',
      confirmText: 'Borrar todo',
      destructive: true,
    });
    if (ok) clearAll.mutate();
  };

  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-sm text-muted-foreground">
        {name} anota lo que le cuentas (tu talla, tus gustos, lo que le pides que te recuerde) para atenderte mejor la próxima vez.
        Solo tú lo ves y puedes borrarlo cuando quieras. Nunca guarda contraseñas, cédulas ni datos bancarios.
      </p>

      {isLoading ? (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader className="h-4 w-4 animate-spin" /> Cargando…</p>
      ) : pending.length === 0 && done.length === 0 ? (
        <p className="rounded-2xl bg-secondary/60 px-4 py-5 text-center text-sm text-muted-foreground">
          Todavía no recuerda nada. Cuando le cuentes algo útil o le digas "recuérdame…", aparecerá aquí.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[...pending, ...done].map(item => (
            <li key={item.id} className={cn('flex items-start gap-3 px-4 py-3', item.done && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{item.content}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="font-medium uppercase tracking-[0.06em]">{KIND_LABEL[item.kind]}</span>
                  {item.remind_on && (
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{shortDate(item.remind_on)}</span>
                  )}
                  {item.done && <span>· hecho</span>}
                  <span>· anotado el {shortDate(item.created_at)}</span>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                aria-label={`Borrar: ${item.content}`}
                disabled={removeOne.isPending}
                onClick={() => removeOne.mutate(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" className="h-11 w-full rounded-full sm:w-auto" disabled={clearAll.isPending} onClick={() => void askClearAll()}>
        {clearAll.isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
        Borrar todo y empezar de cero
      </Button>
    </div>
  );
}
