// Chat component para Ángela AI Assistant
// REGLA CRÍTICA: Usa exclusivamente Hugging Face Inference API - NO Lovable AI
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { 
  X, 
  Send, 
  Loader2, 
  User,
  Minimize2,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Headphones
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import stitchRosaMascot from '@/assets/stitch-rosa-mascot.png';

// Declarar tipo global para Tidio
declare global {
  interface Window {
    tidioChatApi?: {
      show: () => void;
      hide: () => void;
      open: () => void;
      setVisitorData: (data: Record<string, unknown>) => void;
    };
    abrirTidio?: () => void;
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  action?: ActionData | null;
  showHumanSupport?: boolean;
  suggestions?: Suggestion[];
}

interface ActionData {
  type: string;
  data: Record<string, unknown>;
  status?: 'pending' | 'success' | 'error';
  result?: string;
}

interface Suggestion {
  label: string;
  message: string;
  priority?: number;
}

interface ConversationAnalysis {
  intent: 'purchase' | 'inquiry' | 'support' | 'frustration' | 'greeting' | 'unknown';
  sentiment: 'positive' | 'neutral' | 'negative' | 'confused';
  needsHumanSupport: boolean;
  confidence: number;
}

interface SessionMemory {
  viewedProducts: string[];
  askedQuestions: string[];
  recommendations: string[];
  preferredPayment?: string;
  creditStatus?: string;
  creditLimit?: number;
  lastProducts?: string[];
}

interface AngelaChatProps {
  context?: string;
  className?: string;
}

// Frases que activan atención humana
const HUMAN_SUPPORT_PHRASES = [
  'hablar con un vendedor',
  'atención al cliente',
  'hablar con un asesor',
  'necesito ayuda humana',
  'quiero hablar con alguien',
  'contactar vendedor',
  'hablar con persona',
  'soporte humano',
  'agente humano',
  'persona real'
];

const ANGELA_GREETING = "¡Hola! 🩷 Soy **Ángela**, tu asistente inteligente de Manojitos. Estoy aquí para ayudarte con productos, precios, crédito y más. ¿Qué necesitas hoy? ✨";

const SUPABASE_URL = 'https://utfoempgdbhhikpvbvir.supabase.co';

// Detectar si el usuario quiere atención humana
function detectHumanSupportRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return HUMAN_SUPPORT_PHRASES.some(phrase => lowerMessage.includes(phrase));
}

// Abrir Tidio para atención humana con contexto
function openHumanSupport(sessionMemory: SessionMemory, lastRecommendation?: string) {
  // Pasar contexto del cliente a Tidio
  if (window.tidioChatApi) {
    try {
      window.tidioChatApi.setVisitorData({
        name: 'Cliente Manojitos',
        credit_status: sessionMemory.creditStatus || 'Sin información',
        credit_limit: sessionMemory.creditLimit || 0,
        preferred_payment: sessionMemory.preferredPayment || 'No definido',
        last_products_viewed: sessionMemory.viewedProducts.slice(-5).join(', ') || 'Ninguno',
        last_recommendation: lastRecommendation || 'Ninguna',
        questions_asked: sessionMemory.askedQuestions.slice(-3).join(' | ') || 'Ninguna',
      });
    } catch (e) {
      console.error('Error setting Tidio visitor data:', e);
    }

    window.tidioChatApi.show();
    window.tidioChatApi.open();
  } else if (window.abrirTidio) {
    window.abrirTidio();
  } else {
    toast.error('El chat de atención humana no está disponible en este momento');
  }
}

// Ejecutar acción en el backend con autenticación
async function executeBackendAction(action: ActionData, userId?: string): Promise<{ success: boolean; message: string }> {
  try {
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add auth header if session exists
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers,
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

// Sugerencias iniciales rápidas para clientes
const CUSTOMER_INITIAL_SUGGESTIONS: Suggestion[] = [
  { label: "🔥 Más vendidos", message: "¿Cuáles son los productos más vendidos?" },
  { label: "💰 Tasa BCV", message: "¿Cuál es la tasa BCV actual?" },
  { label: "💳 Mi crédito", message: "¿Cuánto crédito tengo disponible?" },
  { label: "🛒 Ver productos", message: "¿Qué productos tienen disponibles?" },
  { label: "🧑‍💼 Asesor", message: "Quiero hablar con un asesor" },
];

// Sugerencias iniciales para admins
const ADMIN_INITIAL_SUGGESTIONS: Suggestion[] = [
  { label: "📊 Resumen ventas", message: "Dame un resumen de ventas de esta semana" },
  { label: "💰 Calcular precio", message: "Calcula el precio de 5 productos a $10 con tasa BCV" },
  { label: "📉 Stock bajo", message: "¿Cuáles productos tienen stock bajo?" },
  { label: "💳 Créditos", message: "¿Cuáles clientes tienen créditos pendientes?" },
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

// Extraer productos mencionados del mensaje
function extractProductMentions(content: string): string[] {
  const productPatterns = [
    /\*\*([^*]+)\*\*/g,  // **Producto**
    /producto[s]?\s+(\w+)/gi,  // producto X
  ];
  
  const products: string[] = [];
  productPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1] && match[1].length > 2 && !['tu', 'el', 'la', 'los', 'las'].includes(match[1].toLowerCase())) {
        products.push(match[1]);
      }
    }
  });
  
  return products;
}

export function AngelaChat({ context, className }: AngelaChatProps) {
  const { isAdmin, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: ANGELA_GREETING, suggestions: isAdmin ? ADMIN_INITIAL_SUGGESTIONS : CUSTOMER_INITIAL_SUGGESTIONS }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionMemory, setSessionMemory] = useState<SessionMemory>({
    viewedProducts: [],
    askedQuestions: [],
    recommendations: [],
  });
  const [lastAnalysis, setLastAnalysis] = useState<ConversationAnalysis | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Obtener la última sugerencia de la conversación
  const getLastSuggestions = useCallback((): Suggestion[] => {
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    return lastAssistantMessage?.suggestions || (isAdmin ? ADMIN_INITIAL_SUGGESTIONS : CUSTOMER_INITIAL_SUGGESTIONS);
  }, [messages, isAdmin]);

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

  // Actualizar memoria de sesión
  const updateSessionMemory = useCallback((userMessage: string, assistantResponse: string) => {
    setSessionMemory(prev => {
      const newMemory = { ...prev };
      
      // Agregar pregunta del usuario
      if (!prev.askedQuestions.includes(userMessage)) {
        newMemory.askedQuestions = [...prev.askedQuestions, userMessage].slice(-10);
      }
      
      // Extraer productos mencionados
      const mentionedProducts = extractProductMentions(assistantResponse);
      mentionedProducts.forEach(product => {
        if (!prev.viewedProducts.includes(product)) {
          newMemory.viewedProducts = [...prev.viewedProducts, product].slice(-20);
        }
      });
      
      // Guardar recomendación si parece ser una
      if (assistantResponse.includes('recomiendo') || assistantResponse.includes('te sugiero')) {
        newMemory.recommendations = [...prev.recommendations, assistantResponse.slice(0, 100)].slice(-5);
      }
      
      return newMemory;
    });
  }, []);

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

    // Detectar si el usuario quiere atención humana
    if (detectHumanSupportRequest(textToSend)) {
      const lastRecommendation = sessionMemory.recommendations[sessionMemory.recommendations.length - 1];
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '¡Entendido! 🩷 Ya te comunico con uno de nuestros asesores humanos. Le dejé toda la información de nuestra conversación para que te atienda más rápido. ✨',
        showHumanSupport: true,
        suggestions: [
          { label: "🧑‍💼 Conectar ahora", message: "Conectar con asesor" },
          { label: "💬 Seguir con Ángela", message: "Prefiero seguir contigo" },
        ]
      }]);
      setIsLoading(false);
      return;
    }

    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add auth header if session exists
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [...messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0), userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          context,
          customerId: user?.id,
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
      const serverSuggestions = data.suggestions as Suggestion[] | undefined;
      const analysis = data.analysis as ConversationAnalysis | undefined;
      
      // Guardar análisis
      if (analysis) {
        setLastAnalysis(analysis);
      }
      
      // Parse for actions
      const { cleanContent, action } = parseAction(rawContent);

      // Actualizar memoria de sesión
      updateSessionMemory(textToSend, cleanContent);

      // Usar sugerencias del servidor o generar locales
      const finalSuggestions = serverSuggestions?.length 
        ? serverSuggestions 
        : generateLocalSuggestions(cleanContent, isAdmin);

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: cleanContent,
        action,
        suggestions: finalSuggestions,
        showHumanSupport: analysis?.needsHumanSupport,
      }]);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `¡Oops! 😅 ${error instanceof Error ? error.message : 'Error desconocido'}. ¿Puedes intentarlo de nuevo? 🩷`,
        suggestions: [
          { label: "🔄 Reintentar", message: textToSend },
          { label: "🧑‍💼 Hablar con asesor", message: "Quiero hablar con un asesor" },
        ]
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Generar sugerencias locales si el servidor no las envía
  const generateLocalSuggestions = (response: string, admin: boolean): Suggestion[] => {
    const suggestions: Suggestion[] = [];
    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('precio') || lowerResponse.includes('bs')) {
      suggestions.push({ label: "💱 Comparar USD/Bs", message: "¿Me conviene pagar en USD o en Bs?" });
    }
    
    if (lowerResponse.includes('producto')) {
      suggestions.push({ label: "🛒 Ver más productos", message: "Muéstrame más productos" });
      suggestions.push({ label: "📦 Hay stock?", message: "¿Tienen stock de este producto?" });
    }
    
    if (lowerResponse.includes('crédito')) {
      suggestions.push({ label: "💳 Mi límite", message: "¿Cuál es mi límite de crédito?" });
    }

    // Siempre agregar opción de asesor
    suggestions.push({ label: "🧑‍💼 Hablar con asesor", message: "Quiero hablar con un asesor humano" });

    // Sugerencias específicas de admin
    if (admin) {
      if (lowerResponse.includes('stock')) {
        suggestions.push({ label: "📉 Ver todos bajos", message: "Muéstrame todos los productos con stock bajo" });
      }
      if (lowerResponse.includes('venta')) {
        suggestions.push({ label: "🛒 Nueva venta", message: "Quiero registrar otra venta" });
      }
    }

    return suggestions.slice(0, 5);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (message: string) => {
    if (message === "Conectar con asesor") {
      const lastRecommendation = sessionMemory.recommendations[sessionMemory.recommendations.length - 1];
      openHumanSupport(sessionMemory, lastRecommendation);
      return;
    }
    sendMessage(message);
  };

  // Format message with markdown and sanitize HTML to prevent XSS
  const formatMessage = (content: string) => {
    // First apply markdown formatting
    const formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
    
    // Sanitize HTML to prevent XSS attacks
    // Only allow safe formatting tags
    return DOMPurify.sanitize(formatted, {
      ALLOWED_TAGS: ['strong', 'em', 'br', 'p', 'span'],
      ALLOWED_ATTR: [],
    });
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
              className="h-16 w-16 rounded-full shadow-lg overflow-hidden border-2 border-primary/30 relative animate-glow-pulse-rosa"
            >
              <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
              {/* Pulse ring effect */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/40"
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
                : "bottom-6 right-6 w-[380px] h-[550px]",
              className
            )}
          >
            <Card className="flex flex-col h-full overflow-hidden border-primary/15 bg-background/95 backdrop-blur-2xl shadow-[0_16px_64px_hsl(var(--rose)/0.15)]">
              {/* Header */}
               <div className="p-4 bg-[#120A0C] flex items-center justify-between border-b border-[#F5EDE8]/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#F5EDE8]/10 flex items-center justify-center p-1 border border-[#F5EDE8]/15 overflow-hidden animate-breathing">
              <img src="/stitch-rosa-mascot.png" alt="Angela" className="w-full h-full object-contain" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#120A0C] shadow-sm" />
          </div>
          <div>
            <h3 className="font-serif font-medium text-[#F5EDE8]">Angela AI</h3>
            <p className="text-[10px] text-[#F5EDE8]/40 font-medium tracking-[0.1em] uppercase">Asistente Virtual</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-[#F5EDE8]/50 hover:text-[#F5EDE8] hover:bg-[#F5EDE8]/5"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Minimizar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-[#F5EDE8]/50 hover:text-[#F5EDE8] hover:bg-[#F5EDE8]/5"
            onClick={() => setIsOpen(false)}
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
                        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-primary/20">
                          <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="max-w-[80%] space-y-2">
                        <div
                          className={cn(
                            "p-3 rounded-2xl text-sm",
                            msg.role === 'user'
                              ? "bg-primary/90 text-primary-foreground rounded-br-sm"
                              : "bg-card/60 backdrop-blur-sm border border-border/10 rounded-bl-sm text-foreground/80"
                          )}
                          dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                        />
                        
                        {/* Human Support Button */}
                        {msg.showHumanSupport && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mt-2"
                          >
                            <Button
                              size="sm"
                              onClick={() => openHumanSupport(sessionMemory, sessionMemory.recommendations[sessionMemory.recommendations.length - 1])}
                              className="bg-gold/90 hover:bg-gold text-white gap-2 rounded-full btn-shimmer shadow-gold"
                            >
                              <Headphones className="h-4 w-4" />
                              Hablar con un asesor
                            </Button>
                          </motion.div>
                        )}
                        
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
                                className="bg-primary/80 hover:bg-primary text-white gap-2 rounded-full btn-shimmer-rosa"
                              >
                                {getActionLabel(msg.action.type)}
                              </Button>
                            ) : msg.action.status === 'success' ? (
                              <div className="flex items-center gap-2 text-sm text-primary">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>{msg.action.result}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                <span>{msg.action.result}</span>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {/* Sugerencias dinámicas después de cada mensaje de Ángela */}
                        {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex flex-wrap gap-1.5 pt-2"
                          >
                            {msg.suggestions.map((suggestion, sIdx) => (
                              <motion.button
                                key={sIdx}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: sIdx * 0.05 }}
                                onClick={() => handleSuggestionClick(suggestion.message)}
                                disabled={isLoading}
                                className="px-3 py-1.5 text-xs bg-card/40 backdrop-blur-sm text-foreground/60 rounded-full hover:bg-card/60 hover:text-foreground/80 transition-all duration-300 border border-border/15 hover:border-primary/20 whitespace-nowrap tracking-wide"
                              >
                                {suggestion.label}
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center text-primary-foreground">
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
                      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-primary/20">
                        <img src={stitchRosaMascot} alt="Ángela" className="w-full h-full object-cover" />
                      </div>
                      <div className="bg-card/40 backdrop-blur-sm border border-border/10 p-3 rounded-2xl rounded-bl-sm">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Ángela está pensando...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-border/10 bg-background/80 backdrop-blur-sm">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu mensaje..."
                    disabled={isLoading}
                    className="flex-1 rounded-full bg-card/30 border-border/15 focus:border-primary/30"
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="rounded-full bg-primary/80 hover:bg-primary text-primary-foreground"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/30 text-center mt-2 tracking-widest uppercase">
                  Ángela • Asistente Inteligente
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
