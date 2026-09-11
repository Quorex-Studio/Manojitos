import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader, Search, InfoCircle } from 'reicon-react';
import { useProductSummary, useProductDebtors } from '@/hooks/useProductSummary';
import { formatBS } from '@/lib/utils';
import type { ProductSummary, ProductDebtor } from '@/types';
import type { GroupedSale } from '@/pages/Sales';

interface ProductSummaryTabProps {
  onViewDebtorAccount: (debtor: ProductDebtor) => void;
}

export function ProductSummaryTab({ onViewDebtorAccount }: ProductSummaryTabProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  
  const { data: summaries, isLoading, error } = useProductSummary(
    dateFilter === 'all' ? null : 
    dateFilter === 'today' ? new Date(new Date().setHours(0,0,0,0)) : 
    dateFilter === 'week' ? new Date(new Date().setDate(new Date().getDate() - 7)) : 
    dateFilter === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : null,
    null,
    category === 'all' ? null : category
  );

  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);

  const filteredSummaries = summaries?.filter(s => 
    s.product_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl font-bold">Resumen por Producto</h2>
          <p className="text-sm text-muted-foreground">Ventas consolidadas, pendientes y pedidos por artículo</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-secondary/30 p-3 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Buscar producto..." 
            className="pl-10 input-glass border-none shadow-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-auto flex gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[140px] input-glass border-none">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="Ropa">Ropa</SelectItem>
              <SelectItem value="Calzado">Calzado</SelectItem>
              <SelectItem value="Perfumeria">Perfumería</SelectItem>
              <SelectItem value="Electrónica">Electrónica</SelectItem>
              <SelectItem value="Hogar">Hogar</SelectItem>
              <SelectItem value="Otros">Otros</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px] input-glass border-none">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo histórico</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Últimos 7 días</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center p-12 text-destructive">
          <p>Error al cargar el resumen: {(error as Error).message}</p>
        </div>
      ) : !filteredSummaries?.length ? (
        <div className="text-center p-12 bg-secondary/20 rounded-xl border border-dashed border-border/50">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-lg font-medium text-muted-foreground">No hay ventas en este período</p>
        </div>
      ) : (
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow>
                  <TableHead className="font-semibold text-primary">Producto</TableHead>
                  <TableHead className="text-right">Vendido</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Por Cobrar</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Total $</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummaries.map(product => (
                  <TableRow key={product.product_id} className="hover:bg-primary/5 cursor-pointer" onClick={() => setSelectedProduct(product)}>
                    <TableCell className="font-medium">
                      {product.product_name}
                      {product.category && (
                        <Badge variant="outline" className="ml-2 text-[10px] scale-90 opacity-70">
                          {product.category}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{Number(product.vendido)}</TableCell>
                    <TableCell className="text-right">{Number(product.ventas)}</TableCell>
                    <TableCell className="text-right text-amber-500 font-medium">{Number(product.por_cobrar)}</TableCell>
                    <TableCell className="text-right text-blue-500 font-medium">{Number(product.pedidos)}</TableCell>
                    <TableCell className="text-right">${Number(product.total_usd).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-green-500">${Number(product.cobrado).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold text-destructive">${Number(product.pendiente).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                        <InfoCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {selectedProduct && (
        <ProductDetailModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          onViewDebtorAccount={onViewDebtorAccount}
        />
      )}
    </div>
  );
}

function ProductDetailModal({ product, onClose, onViewDebtorAccount }: { product: ProductSummary, onClose: () => void, onViewDebtorAccount: (d: ProductDebtor) => void }) {
  const [showDebtors, setShowDebtors] = useState(false);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {product.product_name}
          </DialogTitle>
        </DialogHeader>
        
        {!showDebtors ? (
          <div className="space-y-6 py-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Cantidades</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-secondary/40 p-3 rounded-lg text-center border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Vendidos</p>
                  <p className="text-xl font-bold">{Number(product.vendido)}</p>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg text-center border border-primary/20">
                  <p className="text-xs text-primary/80 mb-1">Ventas</p>
                  <p className="text-xl font-bold text-primary">{Number(product.ventas)}</p>
                </div>
                <div className="bg-amber-500/10 p-3 rounded-lg text-center border border-amber-500/20">
                  <p className="text-xs text-amber-500/80 mb-1">Por cobrar</p>
                  <p className="text-xl font-bold text-amber-500">{Number(product.por_cobrar)}</p>
                </div>
                <div className="bg-blue-500/10 p-3 rounded-lg text-center border border-blue-500/20">
                  <p className="text-xs text-blue-500/80 mb-1">Pedidos</p>
                  <p className="text-xl font-bold text-blue-500">{Number(product.pedidos)}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Finanzas</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-secondary/40 p-3 rounded-lg text-center border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Total</p>
                  <p className="text-lg font-bold">${Number(product.total_usd).toFixed(2)}</p>
                </div>
                <div className="bg-green-500/10 p-3 rounded-lg text-center border border-green-500/20">
                  <p className="text-xs text-green-500/80 mb-1">Cobrado</p>
                  <p className="text-lg font-bold text-green-500">${Number(product.cobrado).toFixed(2)}</p>
                </div>
                <div className="bg-destructive/10 p-3 rounded-lg text-center border border-destructive/20">
                  <p className="text-xs text-destructive/80 mb-1">Pendiente</p>
                  <p className="text-lg font-bold text-destructive">${Number(product.pendiente).toFixed(2)}</p>
                </div>
              </div>
              {product.total_bs > 0 && (
                <div className="mt-3 bg-secondary/20 p-2 rounded-lg text-center text-sm">
                  <span className="text-muted-foreground">Total Histórico Bs: </span>
                  <span className="font-semibold text-primary">{formatBS(product.total_bs)}</span>
                </div>
              )}
            </div>

            {Number(product.pendiente) > 0 && (
              <Button onClick={() => setShowDebtors(true)} className="w-full btn-gold" size="lg">
                <Search className="h-4 w-4 mr-2" />
                Ver quién debe
              </Button>
            )}
          </div>
        ) : (
          <DebtorsList productId={product.product_id} onBack={() => setShowDebtors(false)} onViewDebtorAccount={onViewDebtorAccount} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DebtorsList({ productId, onBack, onViewDebtorAccount }: { productId: string, onBack: () => void, onViewDebtorAccount: (d: ProductDebtor) => void }) {
  const { data: debtors, isLoading } = useProductDebtors(productId);

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
          &larr; Volver
        </Button>
        <h4 className="font-semibold flex-1 text-center pr-8">Deudas Activas</h4>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !debtors?.length ? (
        <p className="text-center text-muted-foreground py-8">Este producto no tiene cuentas pendientes.</p>
      ) : (
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
          {debtors.map(debtor => (
            <div key={debtor.sale_id} className="bg-secondary/40 p-3 rounded-xl border border-border/50 flex justify-between items-center">
              <div>
                <p className="font-bold text-sm">{debtor.client_name || 'Cliente sin nombre'}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(debtor.quantity)} unidades &bull; {new Date(debtor.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-destructive">${Number(debtor.pending_usd).toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground line-through opacity-70">${Number(debtor.total_usd).toFixed(2)}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                  onClick={() => onViewDebtorAccount(debtor)}
                >
                  <InfoCircle className="h-3.5 w-3.5 mr-1" />
                  Ver
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
