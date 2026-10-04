import { Fragment, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { parseChatMarkdown, type Inline } from '@/lib/chatMarkdown';

interface Props {
  text: string;
  className?: string;
  /** Enlaces internos (/ruta): navegan sin recargar y cierran el chat */
  onNavigate?: (to: string) => void;
}

function InlineNodes({ nodes, onNavigate }: { nodes: Inline[]; onNavigate?: (to: string) => void }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'text':
            return <Fragment key={i}>{n.v}</Fragment>;
          case 'bold':
            return <strong key={i} className="font-semibold text-foreground"><InlineNodes nodes={n.v} onNavigate={onNavigate} /></strong>;
          case 'italic':
            return <em key={i}><InlineNodes nodes={n.v} onNavigate={onNavigate} /></em>;
          case 'code':
            return <code key={i} className="rounded bg-background/70 px-1 py-0.5 text-[0.85em]">{n.v}</code>;
          case 'link':
            return n.href.startsWith('/') && onNavigate ? (
              <button key={i} type="button" onClick={() => onNavigate(n.href)} className="font-medium text-primary underline underline-offset-2">
                {n.v}
              </button>
            ) : (
              <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">{n.v}</a>
            );
        }
      })}
    </>
  );
}

/**
 * Respuesta de la asistente con formato: párrafos, títulos, listas y tablas pequeñas.
 * El texto nunca se inyecta como HTML (ver `lib/chatMarkdown.ts`).
 */
export function ChatMarkdown({ text, className, onNavigate }: Props) {
  const blocks = useMemo(() => parseChatMarkdown(text), [text]);
  return (
    <div className={cn('space-y-2 break-words leading-relaxed', className)}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p':
            return <p key={i} className="whitespace-pre-line"><InlineNodes nodes={b.v} onNavigate={onNavigate} /></p>;
          case 'h':
            return (
              <p key={i} className="pt-1 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-foreground/80">
                <InlineNodes nodes={b.v} onNavigate={onNavigate} />
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="space-y-1 pl-1">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span aria-hidden className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span className="min-w-0 whitespace-pre-line"><InlineNodes nodes={item} onNavigate={onNavigate} /></span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="space-y-1 pl-1">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="shrink-0 font-semibold tabular-nums text-primary">{b.start + j}.</span>
                    <span className="min-w-0 whitespace-pre-line"><InlineNodes nodes={item} onNavigate={onNavigate} /></span>
                  </li>
                ))}
              </ol>
            );
          case 'table':
            return (
              <div key={i} className="-mx-1 overflow-x-auto rounded-xl border border-border bg-background/60">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-border">
                      {b.head.map((c, j) => (
                        <th key={j} className="whitespace-nowrap px-2.5 py-1.5 font-semibold"><InlineNodes nodes={c} onNavigate={onNavigate} /></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-border/60 last:border-0">
                        {r.map((c, k) => (
                          <td key={k} className="px-2.5 py-1.5 align-top"><InlineNodes nodes={c} onNavigate={onNavigate} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
