// Chat component para Ángela AI Assistant
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Send, 
  Loader2, 
  User,
  Minimize2,
  Maximize2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import stitchRosaMascot from '@/assets/stitch-rosa-mascot.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  action?: ActionData | null;
}

interface ActionData {
  type: string;
  data: Record<string, unknown>;
  status?: 'pending' | 'success' | 'error';
  result?: string;
}

interface AngelaChatProps {
  context?: string;
  className?: string;
}

const ANGELA_GREETING = "¡Hola! 🩷 Soy **Ángela**, tu asistente adorable de Manojitos. ¿En qué puedo ayudarte hoy? ✨";

const SUPABASE_URL = 'https://utfoempgdbhhikpvbvir.supabase.co';

// Ejecutar acción en el backend
async function executeBackendAction(action: ActionData, userId?: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: {
          type: action.type,
          data: action.data,
        },
        adminUserId: userId,
      }),
    });

    const result = await response.json();
    return {
      success: result.success ?? false,
      message: result.message || 'Acción completada',
    };
  } catch (error) {
    console.error('Backend action error:', error);
    return {
      success: false,
      message: 'Error al ejecutar la acción en el servidor',
    };
  }
}

// Sugerencias rápidas para clientes
const CUSTOMER_SUGGESTIONS = [
  { label: "📦 Mis pedidos", message: "¿Cuál es el estado de mis pedidos?" },
  { label: "💳 Mi crédito", message: "¿Cuánto crédito tengo disponible?" },
  { label: "🛒 Productos", message: "¿Qué productos me recomiendas?" },
  { label: "💰 Tasa BCV", message: "¿Cuál es la tasa BCV actual?" },
];

// Sugerencias rápidas para admins
const ADMIN_SUGGESTIONS = [
  { label: "📊 Ventas", message: "Dame un resumen de ventas de esta semana" },
  { label: "💰 Calcular precio", message: "Calcula el precio de 5 productos a $10 con tasa BCV + 10.7%" },
  { label: "📦 Stock bajo", message: "¿Cuáles productos tienen stock bajo?" },
  { label: "👥 Créditos", message: "¿Cuáles clientes tienen créditos pendientes?" },
  { label: "🛒 Registrar venta", message: "Quiero registrar una venta rápida" },
];

// Parse action from AI response
function parseAction(content: string): { cleanContent: string; action: ActionData | null } {
  const actionMatch = content.match(/```action\s*([\s\S]*?)\s*```/);
  
  if (actionMatch) {
    try {
      const actionData = JSON.parse(actionMatch[1]) as ActionData;
      const cleanContent = content.replace(/```action\s*[\s\S]*?\s*```/g, '').trim();
      return { cleanContent, action: { ...actionData, status: 'pending' } };
    } catch (e) {
      console.error('Error parsing action:', e);
    }
  }
  
  return { cleanContent: content, action: null };
}

export function AngelaChat({ context, className }: AngelaChatProps) {
  const { isAdmin, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: ANGELA_GREETING }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = isAdmin ? ADMIN_SUGGESTIONS : CUSTOMER_SUGGESTIONS;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const executeAction = async (action: ActionData, messageIndex: number) => {
    try {
      const result = await executeBackendAction(action, user?.id);
      
      setMessages(prev => prev.map((msg, idx) => {
        if (idx === messageIndex && msg.action) {
          return {
            ...msg,
            action: {
              ...msg.action,
              status: result.success ? 'success' : 'error',
              result: result.message
            }
          };
        }
        return msg;
      }));

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Action error:', error);
      toast.error('Error al ejecutar la acción');
    }
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0), userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          context,
          isAdmin,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error('Demasiadas solicitudes. Por favor intenta de nuevo en unos segundos. 🩷');
        }
        if (response.status === 402) {
          throw new Error('Créditos de AI agotados. Por favor contacta al administrador. 💖');
        }
        throw new Error(errorData.error || 'Error al contactar con Ángela');
      }

      const data = await response.json();
      const rawContent = data.content || '¡Ups! No pude procesar eso. ¿Podrías intentar de nuevo? 🩷';
      
      // Parse for actions
      const { cleanContent, action } = parseAction(rawContent);

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: cleanContent,
        action 
      }]);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `¡Oops! 😅 ${error instanceof Error ? error.message : 'Error desconocido'}. ¿Puedes intentarlo de nuevo? 🩷`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (message: string) => {
    sendMessage(message);
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  const getActionLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'QUERY_PRODUCTS': '🔍 Buscar productos',
      'REGISTER_SALE': '💰 Registrar venta',
      'SEND_REMINDER': '📧 Enviar recordatorio',
      'CHECK_STOCK': '📦 Verificar stock',
      'GET_CREDIT_INFO': '💳 Info de crédito',
    };
    return labels[type] || type;
  };

  return (
    <>
      {/* Floating Button with bounce animation */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              y: [0, -8, 0],
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              y: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }
            }}
            className={cn("fixed bottom-6 right-6 z-50", className)}
          >
            <motion.button
              onClick={() => setIsOpen(true)}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              className="h-16 w-16 rounded-full shadow-lg overflow-hidden border-2 border-pink-300 relative"
            >
              <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
              {/* Pulse ring effect */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-pink-400"
                animate={{
                  scale: [1, 1.3, 1.3],
                  opacity: [0.8, 0, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "fixed z-50 shadow-2xl",
              isExpanded 
                ? "inset-4 md:inset-8" 
                : "bottom-6 right-6 w-[380px] h-[500px]",
              className
            )}
          >
            <Card className="flex flex-col h-full overflow-hidden border-pink-200 dark:border-pink-800">
              {/* Header */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30">
                    <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Ángela</h3>
                    <p className="text-xs text-white/80">Tu asistente adorable 🩷</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-white hover:bg-white/20"
                  >
                    {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="text-white hover:bg-white/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-3",
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-pink-300">
                          <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="max-w-[80%] space-y-2">
                        <div
                          className={cn(
                            "p-3 rounded-2xl text-sm",
                            msg.role === 'user'
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
                          )}
                          dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                        />
                        
                        {/* Action Button */}
                        {msg.action && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mt-2"
                          >
                            {msg.action.status === 'pending' ? (
                              <Button
                                size="sm"
                                onClick={() => executeAction(msg.action!, idx)}
                                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white gap-2"
                              >
                                {getActionLabel(msg.action.type)}
                              </Button>
                            ) : msg.action.status === 'success' ? (
                              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>{msg.action.result}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                                <AlertCircle className="h-4 w-4" />
                                <span>{msg.action.result}</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-pink-300">
                        <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
                      </div>
                      <div className="bg-muted p-3 rounded-2xl rounded-bl-sm">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Ángela está pensando...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {/* Quick Suggestions */}
                  {showSuggestions && messages.length === 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-wrap gap-2 pt-2"
                    >
                      {suggestions.map((suggestion, idx) => (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          onClick={() => handleSuggestionClick(suggestion.message)}
                          disabled={isLoading}
                          className="px-3 py-1.5 text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full hover:bg-pink-200 dark:hover:bg-pink-800/50 transition-colors border border-pink-200 dark:border-pink-700"
                        >
                          {suggestion.label}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t bg-background">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu mensaje..."
                    disabled={isLoading}
                    className="flex-1 rounded-full"
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Ángela - Tu asistente inteligente 🩷
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
