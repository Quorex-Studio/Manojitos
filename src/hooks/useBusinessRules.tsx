/**
 * useBusinessRules — Hook to manage and evaluate dynamic business rules.
 * Tables: `business_rules`
 * RPC: `evaluate_business_rules`
 * Returns: { rules, isLoading, initializeDefaultRules, createRule, updateRule, toggleRule, deleteRule, evaluateRules, stats }
 */
// Hook para reglas de negocio configurables
// Permite a los admins configurar reglas sin modificar código

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';
import type { 
  BusinessRule, 
  RuleConditions, 
  RuleActions, 
  RuleType, 
  BusinessRuleInput 
} from '@/types';


// Reglas predeterminadas del sistema
export const DEFAULT_RULES: BusinessRuleInput[] = [
  {
    rule_key: 'auto_block_critical',
    rule_name: 'Bloqueo automático por score crítico',
    description: 'Bloquea automáticamente clientes con trust score menor a 30',
    rule_type: 'credit_block',
    conditions: { max_trust_score: 30 },
    actions: { block_credit: true, restriction_level: 3 },
    is_active: true,
    priority: 100,
  },
  {
    rule_key: 'reduce_limit_risk',
    rule_name: 'Reducir límite por riesgo',
    description: 'Reduce el límite de crédito 30% para clientes en riesgo',
    rule_type: 'limit_adjustment',
    conditions: { min_trust_score: 30, max_trust_score: 60 },
    actions: { reduce_limit_percentage: 30, restriction_level: 1 },
    is_active: true,
    priority: 80,
  },
  {
    rule_key: 'notify_overdue_7_days',
    rule_name: 'Notificación por mora de 7 días',
    description: 'Envía notificación cuando un crédito tiene más de 7 días de mora',
    rule_type: 'notification',
    conditions: { min_overdue_days: 7 },
    actions: { send_notification: true, notification_channel: ['email', 'internal'] },
    is_active: true,
    priority: 60,
  },
  {
    rule_key: 'block_overdue_15_days',
    rule_name: 'Bloqueo por mora de 15 días',
    description: 'Bloquea automáticamente créditos con más de 15 días de mora',
    rule_type: 'credit_block',
    conditions: { min_overdue_days: 15 },
    actions: { block_credit: true, restriction_level: 3 },
    is_active: true,
    priority: 90,
  },
  {
    rule_key: 'cash_only_critical',
    rule_name: 'Solo contado para clientes críticos',
    description: 'Restringe a solo pago de contado para clientes con score crítico',
    rule_type: 'restriction',
    conditions: { max_trust_score: 40 },
    actions: { restriction_level: 2 },
    is_active: true,
    priority: 70,
  },
];

// Hook principal de reglas de negocio
export function useBusinessRules() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch reglas
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['business-rules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_rules')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;
      return data as BusinessRule[];
    },
    enabled: !!user && isAdmin,
  });

  // Inicializar reglas predeterminadas
  const initializeDefaultRules = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No autenticado');

      // Verificar si ya existen reglas
      const { count } = await supabase
        .from('business_rules')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (count && count > 0) {
        return { message: 'Las reglas ya están inicializadas' };
      }

      // Insertar reglas predeterminadas
      const rulesToInsert = DEFAULT_RULES.map(rule => ({
        user_id: user.id,
        rule_key: rule.rule_key,
        rule_name: rule.rule_name,
        description: rule.description,
        rule_type: rule.rule_type,
        conditions: rule.conditions as Json,
        actions: rule.actions as Json,
        is_active: rule.is_active ?? true,
        priority: rule.priority ?? 0,
      }));

      const { error } = await supabase
        .from('business_rules')
        .insert(rulesToInsert);

      if (error) throw error;
      return { message: 'Reglas inicializadas correctamente' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
      toast({ title: 'Reglas inicializadas' });
    },
  });

  // Crear nueva regla
  const createRule = useMutation({
    mutationFn: async (input: BusinessRuleInput) => {
      if (!user || !isAdmin) throw new Error('No autorizado');

      const insertData = {
        user_id: user.id,
        rule_key: input.rule_key,
        rule_name: input.rule_name,
        description: input.description,
        rule_type: input.rule_type,
        conditions: input.conditions as Json,
        actions: input.actions as Json,
        is_active: input.is_active ?? true,
        priority: input.priority ?? 0,
      };

      const { data, error } = await supabase
        .from('business_rules')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
      toast({ title: 'Regla creada' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear la regla',
        variant: 'destructive',
      });
    },
  });

  // Actualizar regla
  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BusinessRule> & { id: string }) => {
      if (!isAdmin) throw new Error('No autorizado');

      const updateData: Record<string, unknown> = {};
      if (updates.rule_name) updateData.rule_name = updates.rule_name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.rule_type) updateData.rule_type = updates.rule_type;
      if (updates.conditions) updateData.conditions = updates.conditions as Json;
      if (updates.actions) updateData.actions = updates.actions as Json;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.priority !== undefined) updateData.priority = updates.priority;

      const { data, error } = await supabase
        .from('business_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
      toast({ title: 'Regla actualizada' });
    },
  });

  // Toggle activar/desactivar regla
  const toggleRule = useMutation({
    mutationFn: async (id: string) => {
      const rule = rules.find(r => r.id === id);
      if (!rule) throw new Error('Regla no encontrada');

      const { data, error } = await supabase
        .from('business_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
      toast({
        title: data.is_active ? 'Regla activada' : 'Regla desactivada',
      });
    },
  });

  // Eliminar regla
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('business_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
      toast({ title: 'Regla eliminada' });
    },
  });

  // Evaluar reglas para un contexto dado
  const evaluateRules = async (context: {
    trust_score?: number;
    overdue_days?: number;
    balance?: number;
    credit_status?: string;
  }) => {
    if (!user) return [];

    // Llamar a la función de la BD
    const { data, error } = await supabase.rpc('evaluate_business_rules', {
      p_admin_user_id: user.id,
      p_context: context as Json,
    });

    if (error) {
      console.error('Error evaluando reglas:', error);
      return [];
    }

    // Cast result properly
    const result = data as unknown;
    if (!Array.isArray(result)) return [];
    
    return result as Array<{
      rule_id: string;
      rule_key: string;
      actions: RuleActions;
    }>;
  };

  // Estadísticas de reglas
  const stats = {
    total: rules.length,
    active: rules.filter(r => r.is_active).length,
    inactive: rules.filter(r => !r.is_active).length,
    byType: {
      credit_block: rules.filter(r => r.rule_type === 'credit_block').length,
      limit_adjustment: rules.filter(r => r.rule_type === 'limit_adjustment').length,
      notification: rules.filter(r => r.rule_type === 'notification').length,
      restriction: rules.filter(r => r.rule_type === 'restriction').length,
    },
  };

  return {
    rules,
    isLoading,
    initializeDefaultRules,
    createRule,
    updateRule,
    toggleRule,
    deleteRule,
    evaluateRules,
    stats,
  };
}
