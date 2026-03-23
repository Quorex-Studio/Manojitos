import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Scale, 
  Plus, 
  Edit2, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useBusinessRules, BusinessRuleInput, RuleType } from '@/hooks/useBusinessRules';
import { toast } from '@/hooks/use-toast';

const RULE_TYPES: { value: RuleType; label: string; description: string }[] = [
  { value: 'credit_block', label: 'Bloqueo de Crédito', description: 'Bloquea crédito automáticamente' },
  { value: 'limit_adjustment', label: 'Ajuste de Límite', description: 'Ajusta límites según comportamiento' },
  { value: 'notification', label: 'Notificación', description: 'Envía alertas personalizadas' },
  { value: 'restriction', label: 'Restricción', description: 'Aplica restricciones de pago' },
];

export default function BusinessRules() {
  // --- STATE ---
  const { rules, isLoading, createRule, updateRule, toggleRule, deleteRule, initializeDefaultRules, stats } = useBusinessRules();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState<Partial<BusinessRuleInput>>({
    rule_name: '',
    rule_key: '',
    rule_type: 'notification',
    description: '',
    priority: 0,
    is_active: true,
    conditions: {},
    actions: {},
  });

  // --- DERIVED / EFFECTS ---

  // --- HANDLERS ---

  const handleCreate = () => {
    setSelectedRule(null);
    setFormData({
      rule_name: '',
      rule_key: '',
      rule_type: 'notification',
      description: '',
      priority: 0,
      is_active: true,
      conditions: {},
      actions: {},
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (rule: typeof rules[0]) => {
    setSelectedRule(rule.id);
    setFormData({
      rule_name: rule.rule_name,
      rule_key: rule.rule_key,
      rule_type: rule.rule_type as RuleType,
      description: rule.description || '',
      priority: rule.priority || 0,
      is_active: rule.is_active ?? true,
      conditions: rule.conditions as Record<string, unknown>,
      actions: rule.actions as Record<string, unknown>,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.rule_name || !formData.rule_key || !formData.rule_type) {
      toast({ title: 'Error', description: 'Completa los campos requeridos', variant: 'destructive' });
      return;
    }

    if (selectedRule) {
      updateRule.mutate({ id: selectedRule, ...formData as BusinessRuleInput });
    } else {
      createRule.mutate(formData as BusinessRuleInput);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (selectedRule) {
      deleteRule.mutate(selectedRule);
      setIsDeleteOpen(false);
      setSelectedRule(null);
    }
  };

  const handleToggle = (id: string) => {
    toggleRule.mutate(id);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRules(newExpanded);
  };

  const getRuleTypeInfo = (type: string) => {
    return RULE_TYPES.find(t => t.value === type) || RULE_TYPES[2];
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="page-header flex items-center gap-3">
              <Scale className="h-8 w-8 text-primary" />
              Reglas de Negocio
            </h1>
            <p className="page-subtitle">Automatiza decisiones de crédito y notificaciones</p>
          </div>
          
          <div className="flex gap-2">
            {rules.length === 0 && (
              <Button 
                variant="outline"
                onClick={() => initializeDefaultRules.mutate()}
                disabled={initializeDefaultRules.isPending}
              >
                {initializeDefaultRules.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Settings2 className="h-4 w-4 mr-2" />
                )}
                Cargar Reglas Base
              </Button>
            )}
            <Button onClick={handleCreate} className="btn-gold">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Regla
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Total reglas</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{stats.active}</div>
              <p className="text-sm text-muted-foreground">Activas</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">{stats.inactive}</div>
              <p className="text-sm text-muted-foreground">Inactivas</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{Object.keys(stats.byType).length}</div>
              <p className="text-sm text-muted-foreground">Tipos en uso</p>
            </CardContent>
          </Card>
        </div>

        {/* Rules List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rules.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sin reglas configuradas</h3>
              <p className="text-muted-foreground mb-4">
                Crea reglas para automatizar decisiones de crédito
              </p>
              <Button onClick={() => initializeDefaultRules.mutate()} variant="outline">
                Cargar Reglas Predeterminadas
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rules.map((rule, index) => {
              const typeInfo = getRuleTypeInfo(rule.rule_type);
              const isExpanded = expandedRules.has(rule.id);
              
              return (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(rule.id)}>
                    <Card className={`glass-card transition-all ${!rule.is_active ? 'opacity-60' : ''}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-lg">{rule.rule_name}</CardTitle>
                              <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                                {rule.is_active ? 'Activa' : 'Inactiva'}
                              </Badge>
                              <Badge variant="outline">{typeInfo.label}</Badge>
                            </div>
                            <CardDescription>{rule.description || typeInfo.description}</CardDescription>
                          </div>
                          
                          <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          rule.is_active ? "bg-primary" : "bg-muted-foreground"
                        )} />
                        <span className="text-xs text-muted-foreground">
                          {rule.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggle(rule.id)}
                            >
                              {rule.is_active ? (
                                <ToggleRight className="h-5 w-5 text-primary" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setSelectedRule(rule.id);
                                setIsDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <div className="grid gap-4 md:grid-cols-2 p-4 bg-secondary/80 rounded-lg">
                            <div>
                              <p className="text-sm font-medium mb-2">Condiciones</p>
                              <pre className="text-xs bg-background/80 p-3 rounded-md overflow-auto max-h-32">
                                {JSON.stringify(rule.conditions, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-sm font-medium mb-2">Acciones</p>
                              <pre className="text-xs bg-background/80 p-3 rounded-md overflow-auto max-h-32">
                                {JSON.stringify(rule.actions, null, 2)}
                              </pre>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                            <span>Prioridad: {rule.priority}</span>
                            <span>Key: {rule.rule_key}</span>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedRule ? 'Editar Regla' : 'Nueva Regla'}</DialogTitle>
              <DialogDescription>
                Configura las condiciones y acciones de la regla
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.rule_name || ''}
                    onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                    placeholder="Nombre de la regla"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clave única *</Label>
                  <Input
                    value={formData.rule_key || ''}
                    onChange={(e) => setFormData({ ...formData, rule_key: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                    placeholder="clave_unica"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Regla *</Label>
                <Select 
                  value={formData.rule_type} 
                  onValueChange={(v) => setFormData({ ...formData, rule_type: v as RuleType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe qué hace esta regla..."
                  rows={2}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Input
                    type="number"
                    value={formData.priority || 0}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>Regla activa</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Condiciones (JSON)</Label>
                <Textarea
                  value={JSON.stringify(formData.conditions, null, 2)}
                  onChange={(e) => {
                    try {
                      setFormData({ ...formData, conditions: JSON.parse(e.target.value) });
                    } catch {}
                  }}
                  placeholder='{"min_trust_score": 50}'
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Acciones (JSON)</Label>
                <Textarea
                  value={JSON.stringify(formData.actions, null, 2)}
                  onChange={(e) => {
                    try {
                      setFormData({ ...formData, actions: JSON.parse(e.target.value) });
                    } catch {}
                  }}
                  placeholder='{"send_notification": true}'
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createRule.isPending || updateRule.isPending}
                className="btn-gold"
              >
                {(createRule.isPending || updateRule.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {selectedRule ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar regla?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La regla será eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
