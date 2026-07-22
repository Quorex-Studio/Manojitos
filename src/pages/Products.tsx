import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Package, Edit2, Trash2, AlertTriangle, ImageIcon } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProducts, Product } from '@/hooks/useProducts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useClientPagination } from '@/hooks/useClientPagination';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatBS } from '@/lib/utils';

export default function Products() {
  // --- STATE ---
  const { products, loading, addProduct, updateProduct, deleteProduct } = useProducts();
  const { rate, convertToBS } = useExchangeRate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
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
  ).sort((a, b) => {
    switch (sortBy) {
      case 'name_asc': return a.name.localeCompare(b.name);
      case 'name_desc': return b.name.localeCompare(a.name);
      case 'stock_asc': return a.stock - b.stock;
      case 'stock_desc': return b.stock - a.stock;
      case 'price_asc': return Number(a.price_usd) - Number(b.price_usd);
      case 'price_desc': return Number(b.price_usd) - Number(a.price_usd);
      case 'sales_desc': return (b.sold_count || 0) - (a.sold_count || 0);
      default: return 0;
    }
  });

  const existingCategories = [...new Set(
    products
      .map(p => p.category)
      .filter((c): c is string => c !== null && c.trim() !== '')
  )];

  // Paginación
  const {
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    paginatedData: paginatedProducts,
    setCurrentPage,
    setPageSize,
  } = useClientPagination(filteredProducts, { pageSize: 10 });

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

    const { sanitizeText } = await import('@/lib/validations');
    const productData = {
      name: sanitizeText(form.name),
      description: form.description ? sanitizeText(form.description) : null,
      price_usd: Number(form.price_usd),
      stock: Number(form.stock),
      category: form.category ? sanitizeText(form.category) : null,
      image_url: form.image_url ? sanitizeText(form.image_url) : null
    };

    if (editingProduct) {
      await updateProduct({ id: editingProduct.id, updates: productData });
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
                    onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]/g, '').slice(0, 100) })}
                    placeholder="Nombre del producto"
                    className="input-glass rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s.,()-]/g, '').slice(0, 255) })}
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
                      onChange={(e) => setForm({ ...form, price_usd: e.target.value.replace(/[^0-9.]/g, '').slice(0, 10) })}
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
                      onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })}
                      placeholder="0"
                      className="input-glass rounded-xl"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Input
                    list="categories-list"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').slice(0, 50) })}
                    placeholder="Ej: Accesorios, Ropa..."
                    className="input-glass rounded-xl"
                  />
                  <datalist id="categories-list">
                    {existingCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos..."
              className="pl-10 input-glass rounded-xl"
            />
          </div>
          
          <Select 
            value={search} 
            onValueChange={(val) => setSearch(val === 'all' ? '' : val)}
          >
            <SelectTrigger className="w-full sm:w-48 input-glass rounded-xl">
              <SelectValue placeholder="Filtrar por categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {existingCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={sortBy} 
            onValueChange={setSortBy}
          >
            <SelectTrigger className="w-full sm:w-48 input-glass rounded-xl">
              <SelectValue placeholder="Ordenar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">A - Z</SelectItem>
              <SelectItem value="name_desc">Z - A</SelectItem>
              <SelectItem value="stock_asc">Menor Stock</SelectItem>
              <SelectItem value="stock_desc">Mayor Stock</SelectItem>
              <SelectItem value="price_asc">Menor Precio</SelectItem>
              <SelectItem value="price_desc">Mayor Precio</SelectItem>
              <SelectItem value="sales_desc">Más Vendidos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {paginatedProducts.map((product, index) => (
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
                              Bs. {formatBS(convertToBS(Number(product.price_usd)))}
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

        {paginatedProducts.length === 0 && !loading && (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No hay productos que mostrar</p>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          className="mt-6"
        />
      </div>
    </AppLayout>
  );
}
