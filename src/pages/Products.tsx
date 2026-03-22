import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Package, Edit2, Trash2, AlertTriangle, ImageIcon } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProducts, Product } from '@/hooks/useProducts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Products() {
  // --- STATE ---
  const { products, loading, addProduct, updateProduct, deleteProduct } = useProducts();
  const { rate, convertToBS } = useExchangeRate();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price_usd: '',
    stock: '',
    category: '',
    image_url: ''
  });

  // --- DERIVED ---

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  // --- HANDLERS ---
  const resetForm = () => {
    setForm({ name: '', description: '', price_usd: '', stock: '', category: '', image_url: '' });
    setEditingProduct(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price_usd: String(product.price_usd),
      stock: String(product.stock),
      category: product.category || '',
      image_url: product.image_url || ''
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const productData = {
      name: form.name,
      description: form.description || null,
      price_usd: Number(form.price_usd),
      stock: Number(form.stock),
      category: form.category || null,
      image_url: form.image_url || null
    };

    if (editingProduct) {
      await updateProduct(editingProduct.id, productData);
    } else {
      await addProduct(productData);
    }
    
    handleOpenChange(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás segura de eliminar este producto?')) {
      await deleteProduct(id);
    }
  };

  // --- RENDER ---
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-header">Productos</h1>
            <p className="page-subtitle">{products.length} productos registrados</p>
          </div>
          
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button className="btn-gold rounded-xl gap-2">
                <Plus className="h-5 w-5" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50 max-w-md">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nombre del producto"
                    className="input-glass rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descripción opcional"
                    className="input-glass rounded-xl resize-none"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Precio (USD) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price_usd}
                      onChange={(e) => setForm({ ...form, price_usd: e.target.value })}
                      placeholder="0.00"
                      className="input-glass rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock *</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                      placeholder="0"
                      className="input-glass rounded-xl"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Ej: Accesorios, Ropa..."
                    className="input-glass rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL de imagen</Label>
                  <Input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://..."
                    className="input-glass rounded-xl"
                  />
                </div>
                <Button type="submit" className="w-full btn-gold rounded-xl">
                  {editingProduct ? 'Actualizar' : 'Crear Producto'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar productos..."
            className="pl-10 input-glass rounded-xl"
          />
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <Card className="glass-card border-border/50 overflow-hidden hover-lift group">
                  {/* Image */}
                  <div className="aspect-square bg-secondary relative overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                    {product.stock <= 5 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute top-2 right-2 gap-1"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Stock bajo
                      </Badge>
                    )}
                    {/* Actions overlay */}
                    <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleEdit(product)}
                        className="rounded-full"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDelete(product.id)}
                        className="rounded-full"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {product.category && (
                        <Badge variant="secondary" className="text-xs">
                          {product.category}
                        </Badge>
                      )}
                      <h3 className="font-semibold text-foreground line-clamp-1">{product.name}</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-gradient-gold">
                            ${Number(product.price_usd).toFixed(2)}
                          </p>
                          {rate > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Bs. {convertToBS(Number(product.price_usd)).toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{product.stock} uds</p>
                          <p className="text-xs text-muted-foreground">{product.sold_count} vendidos</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredProducts.length === 0 && !loading && (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No hay productos que mostrar</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
