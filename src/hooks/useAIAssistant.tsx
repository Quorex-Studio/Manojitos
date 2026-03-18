/**
 * useAIAssistant — Hook to interact with the AI Assistant (Ángela).
 * Mode: 'customer' | 'admin' | 'price_suggestion'
 * Reads: `products`, `sales`, `credits` (via hooks)
 * Invokes: `ai-assistant` edge function
 * Returns: { messages, isLoading, error, sendMessage, clearMessages }
 */
// Hook para usar el asistente IA
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProducts } from './useProducts';
import { useSales } from './useSales';
import { useCredits } from './useCredits';

export type AIAssistantMode = 'customer' | 'admin' | 'price_suggestion';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function useAIAssistant(mode: AIAssistantMode = 'customer') {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // NOTE: This hook fetches all context data (products, sales, credits) regardless of the mode.
  // This can impact performance if the assistant is used in simple contexts.
  // Consider refactoring to lazy-loading or providing context externally.
  const { products } = useProducts();
  const { sales } = useSales();
  const { credits, stats: creditStats } = useCredits();

  // Preparar contexto según el modo
  const getContext = useCallback(() => {
    if (mode === 'customer') {
      return {
        products: products
          .filter(p => p.stock > 0)
          .slice(0, 20)
          .map(p => ({
            name: p.name,
            price_usd: p.price_usd,
            stock: p.stock,
            category: p.category
          }))
      };
    }
    
    if (mode === 'admin') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySales = sales.filter(s => new Date(s.created_at) >= today);
      
      return {
        productsCount: products.length,
        todaySales: todaySales.length,
        activeCredits: creditStats.total - creditStats.byStatus.BLOQUEADO,
        overdueCredits: creditStats.overdue,
        topProducts: products
          .sort((a, b) => b.sold_count - a.sold_count)
          .slice(0, 5)
          .map(p => ({ name: p.name, sold_count: p.sold_count }))
      };
    }

    return {};
  }, [mode, products, sales, creditStats]);

  // Enviar mensaje al asistente
  const sendMessage = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setError(null);

    // Agregar mensaje del usuario
    const userMessage: AIMessage = {
      role: 'user',
      content: prompt,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const context = getContext();
      
      const { data, error: fnError } = await supabase.functions.invoke('ai-assistant', {
        body: { prompt, context, mode }
      });

      if (fnError) throw fnError;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Agregar respuesta del asistente
      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: data?.response || 'No pude generar una respuesta.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('[AI Assistant] Error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Error al conectar con el asistente';
      setError(errorMsg);
      
      // Mensaje de error como respuesta
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Lo siento, hubo un problema: ${errorMsg}. ¿Puedo ayudarte con algo más?`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [mode, getContext]);

  // Limpiar conversación
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages
  };
}
