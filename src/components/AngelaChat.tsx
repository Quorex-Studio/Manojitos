/**
 * AngelaChat — Interfaz de chat flotante para Ángela, la asistente de Manojitos.
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
import { Send, X } from "reicon-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AngelaMascot, { type MascotState } from "@/components/AngelaMascot";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  error?: string;
}

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "🩷 ¡Hola! Soy Ángela, tu asistente de Manojitos. ¿En qué te puedo ayudar hoy? Puedo orientarte con productos, precios en USD y Bs, y tu crédito. ✨",
};

const ERROR_MESSAGE =
  "🩷 Disculpa, tuve un problema para responder en este momento. Intenta de nuevo en unos segundos. ✨";

export default function AngelaChat() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [justAnswered, setJustAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado de la mascota: pensando mientras responde, reacción positiva al recibir.
  const mascotState: MascotState = sending ? "thinking" : justAnswered ? "happy" : "idle";

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

  // Saludo emergente breve del launcher (una sola vez tras cargar).
  useEffect(() => {
    if (loading || !user || open) return;
    const show = setTimeout(() => setShowHint(true), 1800);
    const hide = setTimeout(() => setShowHint(false), 7000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [loading, user, open]);

  // El backend exige autenticación; sin usuario no montamos nada.
  if (loading || !user) return null;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const history = [...messages.filter((m) => m !== WELCOME), userMsg];

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSuggestions([]);
    setSending(true);

    try {
      // functions.invoke adjunta el Authorization: Bearer de la sesión actual.
      const { data, error } = await supabase.functions.invoke<AiAssistantResponse>(
        "ai-assistant",
        { body: { messages: history } },
      );

      if (error || !data?.content) {
        throw error ?? new Error("empty response");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.content as string }]);
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
            className="fixed z-50 flex flex-col items-end gap-2"
            style={{
              right: "calc(1rem + env(safe-area-inset-right))",
              bottom: "calc(1rem + env(safe-area-inset-bottom))",
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
                  🩷 ¡Hola! Soy <span className="font-semibold">Ángela</span>. ¿Te ayudo?
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={() => {
                setShowHint(false);
                setOpen(true);
              }}
              aria-label="Abrir chat con Ángela"
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
            aria-label="Chat con Ángela"
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
                  <p className="text-sm font-semibold">Ángela</p>
                  <p className="text-[11px] opacity-80">
                    {sending ? "Ángela está pensando…" : "Asistente de Manojitos"}
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
                <div
                  key={i}
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
                aria-label="Mensaje para Ángela"
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
