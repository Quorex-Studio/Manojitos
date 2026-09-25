import { BRAND, BRAND_NAME } from '@/config/brand';
/**
 * AngelaChat — Interfaz de chat flotante para Ángela, la asistente de la tienda.
 *
 * Se comunica EXCLUSIVAMENTE con el backend a través de
 * `supabase.functions.invoke('ai-assistant', ...)`, que adjunta automáticamente
 * el JWT de la sesión actual de Supabase. El frontend nunca conoce ni maneja la
 * clave de Gemini ni la llama directamente: toda la lógica de IA, autorización
 * y acciones vive en la Edge Function (contrato A-01..A-08).
 *
 * El launcher solo se monta para usuarios autenticados, porque el backend exige
 * autenticación (A-01) y responde 401 a peticiones anónimas.
 *
 * Ángela se representa con AngelaMascot (personaje rosa animado), no con un icono
 * genérico.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X, Check, ShoppingCart } from "reicon-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCart } from "@/contexts/CartContext";
import { ADMIN_NAV_FLAT, isAdminPathActive } from "@/components/layout/adminNav";
import { OPEN_ANGELA_EVENT } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AngelaMascot, { type MascotState } from "@/components/AngelaMascot";

/** Operación que la asistente dejó preparada; solo se ejecuta al confirmar. */
interface Proposal {
  id: string;
  type: "ADD_TO_CART" | "CREATE_SALE" | "CREATE_PURCHASE" | "REGISTER_ABONO" | "ADD_STOCK";
  title: string;
  lines: string[];
  total?: number;
  confirmLabel: string;
  clientSide?: boolean;
  data: Record<string, unknown>;
  state?: "pending" | "working" | "done" | "cancelled" | "error";
  result?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  proposals?: Proposal[];
}

interface Suggestion {
  label: string;
  message: string;
  priority: number;
}

// Contrato de respuesta de la Edge Function ai-assistant.
interface AiAssistantResponse {
  content?: string;
  suggestions?: Suggestion[];
  proposals?: Proposal[];
  error?: string;
}

interface ActionResult {
  success?: boolean;
  message?: string;
}

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    `🩷 ¡Hola! Soy ${BRAND.assistantName}, tu asistente de ${BRAND_NAME}. Te ayudo a encontrar productos, ver precios en USD y Bs, revisar tu crédito y hasta agregar al carrito lo que quieras comprar. ✨`,
};

const WELCOME_ADMIN: ChatMessage = {
  role: "assistant",
  content:
    `🩷 ¡Hola! Soy ${BRAND.assistantName}. Cuéntame qué pasó y lo registro por ti, por ejemplo:\n• "Vendí 2 bases a María por pago móvil"\n• "Compré $80 en YesStyle"\n• "María abonó $20 por Zelle"\n• "Llegaron 10 protectores solares"\nTambién te digo quién te debe, qué se vende más y qué se está acabando. ✨`,
};

const ERROR_MESSAGE =
  "🩷 Disculpa, tuve un problema para responder en este momento. Intenta de nuevo en unos segundos. ✨";

export default function AngelaChat() {
  const { user, loading, isAdmin } = useAuth();
  const { addItem } = useCart();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [justAnswered, setJustAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const { pathname } = useLocation();
  // En el panel (móvil) el acceso vive en la barra superior: el botón flotante taparía contenido
  const onAdmin = ADMIN_NAV_FLAT.some(i => isAdminPathActive(pathname, i.path));
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado de la mascota: pensando mientras responde, reacción positiva al recibir.
  const mascotState: MascotState = sending ? "thinking" : justAnswered ? "happy" : "idle";

  // Saludo según el rol (la administración ve lo que puede registrar)
  useEffect(() => {
    setMessages(prev => (prev.length === 1 && (prev[0] === WELCOME || prev[0] === WELCOME_ADMIN)) ? [isAdmin ? WELCOME_ADMIN : WELCOME] : prev);
  }, [isAdmin]);

  // Autoscroll al último mensaje.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, sending]);

  // Enfocar el input al abrir.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const openChat = () => { setShowHint(false); setOpen(true); };
    window.addEventListener(OPEN_ANGELA_EVENT, openChat);
    return () => window.removeEventListener(OPEN_ANGELA_EVENT, openChat);
  }, []);

  // Saludo emergente breve del launcher (una sola vez tras cargar; nunca en el panel).
  useEffect(() => {
    if (loading || !user || open || onAdmin) return;
    const show = setTimeout(() => setShowHint(true), 1800);
    const hide = setTimeout(() => setShowHint(false), 7000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [loading, user, open, onAdmin]);

  // El backend exige autenticación; sin usuario no montamos nada.
  if (loading || !user) return null;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const history = [...messages.filter((m) => m !== WELCOME && m !== WELCOME_ADMIN), userMsg]
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSuggestions([]);
    setSending(true);

    try {
      // Adjuntamos explícitamente el JWT del usuario (mismo patrón probado que
      // admin-actions): en este proyecto functions.invoke no propaga el token de
      // sesión por sí solo, y el backend exige un usuario válido (gate A-01), así
      // que sin este header responde 401 "Authentication required".
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessages((prev) => [...prev, { role: "assistant", content: ERROR_MESSAGE }]);
        return;
      }

      const { data, error } = await supabase.functions.invoke<AiAssistantResponse>(
        "ai-assistant",
        {
          body: { messages: history, page: pathname },
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (error || !data?.content) {
        throw error ?? new Error("empty response");
      }

      const proposals = Array.isArray(data.proposals)
        ? data.proposals.map((p) => ({ ...p, state: "pending" as const }))
        : [];
      setMessages((prev) => [...prev, { role: "assistant", content: data.content as string, proposals }]);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 4) : []);
      // Reacción positiva breve de la mascota.
      setJustAnswered(true);
      setTimeout(() => setJustAnswered(false), 1300);
    } catch {
      // Nunca exponemos detalles internos de Supabase/Gemini al usuario.
      setMessages((prev) => [...prev, { role: "assistant", content: ERROR_MESSAGE }]);
    } finally {
      setSending(false);
    }
  }

  function updateProposal(id: string, patch: Partial<Proposal>) {
    setMessages((prev) => prev.map((m) => m.proposals?.some((p) => p.id === id)
      ? { ...m, proposals: m.proposals.map((p) => (p.id === id ? { ...p, ...patch } : p)) }
      : m));
  }

  /** Ejecuta una operación preparada. El carrito se llena aquí; lo demás lo hace el servidor. */
  async function confirmProposal(p: Proposal) {
    if (p.state === "working" || p.state === "done") return;
    updateProposal(p.id, { state: "working" });

    if (p.type === "ADD_TO_CART") {
      const items = (p.data.items as { id: string; name: string; price_usd: number; quantity: number; image_url: string | null; stock: number }[]) || [];
      items.forEach((it) => addItem({ ...it }));
      const units = items.reduce((n, it) => n + it.quantity, 0);
      updateProposal(p.id, { state: "done", result: `Agregado al carrito (${units} ${units === 1 ? "unidad" : "unidades"}).` });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("sin sesión");
      const { data, error } = await supabase.functions.invoke<ActionResult>("ai-assistant", {
        body: { action: { type: p.type, data: p.data } },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.success) {
        updateProposal(p.id, { state: "error", result: data?.message || "No se pudo completar. Inténtalo de nuevo o hazlo desde el panel." });
        return;
      }
      updateProposal(p.id, { state: "done", result: data.message });
      // Ventas, inventario, compras y cuentas por cobrar se refrescan en el panel
      void queryClient.invalidateQueries();
    } catch {
      updateProposal(p.id, { state: "error", result: "No se pudo completar. Revisa tu conexión e inténtalo de nuevo." });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <>
      {/* Launcher — Ángela flotando */}
      <AnimatePresence>
        {!open && (
          <motion.div
            key="launcher"
            className={cn("fixed z-40 flex-col items-end gap-2", onAdmin ? "hidden md:flex" : "flex")}
            style={{
              right: "calc(1rem + env(safe-area-inset-right))",
              bottom: "calc(var(--mobile-tabbar, 0px) + 1rem + env(safe-area-inset-bottom))",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 6 }}
                  className="mr-1 max-w-[200px] rounded-2xl rounded-br-sm border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg"
                >
                  🩷 ¡Hola! Soy <span className="font-semibold">{BRAND.assistantName}</span>. ¿Te ayudo?
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={() => {
                setShowHint(false);
                setOpen(true);
              }}
              aria-label={`Abrir chat con ${BRAND.assistantName}`}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <AngelaMascot state="idle" className="h-16 w-16 sm:h-[76px] sm:w-[76px]" size={76} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel de chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            role="dialog"
            aria-label={`Chat con ${BRAND.assistantName}`}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden border border-border bg-card shadow-2xl",
              // Móvil: casi pantalla completa con márgenes y safe areas.
              "inset-x-3 bottom-3 top-16 rounded-2xl",
              // Desktop: panel acotado abajo a la derecha.
              "sm:inset-auto sm:bottom-4 sm:right-4 sm:top-auto sm:h-[560px] sm:max-h-[80vh] sm:w-[380px]",
            )}
            style={{
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-border bg-primary px-3 py-2.5 text-primary-foreground">
              <div className="flex items-center gap-2.5">
                <AngelaMascot state={mascotState} size={44} className="h-11 w-11" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{BRAND.assistantName}</p>
                  <p className="text-[11px] opacity-80">
                    {sending ? `${BRAND.assistantName} está pensando…` : `Asistente de ${BRAND_NAME}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar chat"
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
              {messages.map((m, i) => (
                <div key={i} className="space-y-2">
                <div
                  className={cn(
                    "flex items-end gap-2",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {m.role === "assistant" && (
                    <AngelaMascot state="idle" size={28} className="h-7 w-7" />
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm",
                      m.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
                {m.proposals?.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    onConfirm={() => void confirmProposal(p)}
                    onCancel={() => updateProposal(p.id, { state: "cancelled" })}
                    onGo={(to) => { setOpen(false); navigate(to); }}
                  />
                ))}
                </div>
              ))}

              {sending && (
                <div className="flex items-end gap-2">
                  <AngelaMascot state="thinking" size={28} className="h-7 w-7" />
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-muted-foreground">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Sugerencias rápidas */}
            {suggestions.length > 0 && !sending && (
              <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void send(s.message)}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border p-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu mensaje…"
                disabled={sending}
                aria-label={`Mensaje para ${BRAND.assistantName}`}
                className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={sending || !input.trim()}
                aria-label="Enviar mensaje"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Tarjeta de una operación preparada: la persona revisa y confirma (o cancela). */
function ProposalCard({ proposal: p, onConfirm, onCancel, onGo }: {
  proposal: Proposal;
  onConfirm: () => void;
  onCancel: () => void;
  onGo: (to: string) => void;
}) {
  const done = p.state === "done";
  return (
    <div className={cn(
      "ml-9 rounded-2xl border bg-card p-3 text-sm shadow-sm",
      done ? "border-success/40" : p.state === "error" ? "border-destructive/40" : "border-border",
      p.state === "cancelled" && "opacity-60",
    )}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {p.type === "ADD_TO_CART" ? <ShoppingCart className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        {p.title}
      </p>
      <ul className="mt-2 space-y-0.5">
        {p.lines.map((l, i) => <li key={i} className="leading-snug">{l}</li>)}
      </ul>
      {typeof p.total === "number" && (
        <p className="mt-2 font-serif text-base font-semibold tabular-nums">Total ${p.total.toFixed(2)}</p>
      )}

      {(p.state === "pending" || p.state === "working" || !p.state) && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1 rounded-full" onClick={onConfirm} disabled={p.state === "working"}>
            {p.state === "working" ? "Guardando…" : p.confirmLabel}
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={onCancel} disabled={p.state === "working"}>
            Cancelar
          </Button>
        </div>
      )}
      {p.state === "cancelled" && <p className="mt-2 text-xs text-muted-foreground">Cancelado. No se guardó nada.</p>}
      {p.result && (p.state === "done" || p.state === "error") && (
        <p className={cn("mt-2 text-xs font-medium", done ? "text-success" : "text-destructive")}>{p.result}</p>
      )}
      {done && p.type === "ADD_TO_CART" && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => onGo("/carrito")}>Ver carrito</Button>
          <Button size="sm" className="flex-1 rounded-full" onClick={() => onGo("/checkout")}>Ir a pagar</Button>
        </div>
      )}
      {done && p.type === "CREATE_SALE" && (
        <Button size="sm" variant="outline" className="mt-2 w-full rounded-full" onClick={() => onGo("/sales")}>Ver en Ventas</Button>
      )}
    </div>
  );
}
