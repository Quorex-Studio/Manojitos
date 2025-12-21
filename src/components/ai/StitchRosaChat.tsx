// Chat component para Stitch Rosa AI Assistant
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  X, 
  Send, 
  Loader2, 
  Sparkles,
  Bot,
  User,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface StitchRosaChatProps {
  context?: string;
  className?: string;
}

const STITCH_GREETING = "¡Hola! 🩷 Soy **Stitch Rosa**, tu asistente adorable de Manojitos. ¿En qué puedo ayudarte hoy? ✨";

const SUPABASE_URL = 'https://utfoempgdbhhikpvbvir.supabase.co';

export function StitchRosaChat({ context, className }: StitchRosaChatProps) {
  const { isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: STITCH_GREETING }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

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
        if (response.status === 503) {
          throw new Error('El modelo está cargando. Por favor intenta de nuevo en unos segundos. 🩷');
        }
        throw new Error(errorData.error || 'Error al contactar con Stitch Rosa');
      }

      const data = await response.json();
      const assistantContent = data.content || '¡Ups! No pude procesar eso. ¿Podrías intentar de nuevo? 🩷';

      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);

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

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn("fixed bottom-6 right-6 z-50", className)}
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white"
            >
              <Sparkles className="h-6 w-6" />
            </Button>
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
                  <div className="p-2 bg-white/20 rounded-full">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Stitch Rosa</h3>
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
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-rose-400 flex items-center justify-center text-white">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] p-3 rounded-2xl text-sm",
                          msg.role === 'user'
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        )}
                        dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                      />
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
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-rose-400 flex items-center justify-center text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="bg-muted p-3 rounded-2xl rounded-bl-sm">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Stitch Rosa está pensando...</span>
                        </div>
                      </div>
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
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Powered by Hugging Face AI 💖
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
