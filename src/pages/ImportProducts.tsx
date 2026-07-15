import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Download,
  Trash2,
  Loader2
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { sanitizeText } from '@/lib/validations';

// Interfaz para un producto parseado del Excel
interface ParsedProduct {
  rowIndex: number;
  nombre_producto: string;
  descripcion: string;
  precio: number;
  stock: number;
  categoria: string;
  proveedor?: string;
  sku?: string;
  isValid: boolean;
  errors: string[];
}

// Interfaz para el resultado de la importación
interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; product: string; error: string }[];
}

// Mapeo de columnas posibles a los campos esperados
const COLUMN_MAPPINGS: Record<string, string> = {
  'nombre_producto': 'nombre_producto',
  'nombre': 'nombre_producto',
  'name': 'nombre_producto',
  'producto': 'nombre_producto',
  'descripcion': 'descripcion',
  'description': 'descripcion',
  'detalle': 'descripcion',
  'precio': 'precio',
  'price': 'precio',
  'precio_usd': 'precio',
  'stock': 'stock',
  'cantidad': 'stock',
  'quantity': 'stock',
  'inventario': 'stock',
  'categoria': 'categoria',
  'category': 'categoria',
  'tipo': 'categoria',
  'proveedor': 'proveedor',
  'provider': 'proveedor',
  'supplier': 'proveedor',
  'sku': 'sku',
  'codigo': 'sku',
  'code': 'sku',
};

export default function ImportProducts() {
  // --- STATE ---
  const { user, isAdmin } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');

  // --- DERIVED / EFFECTS ---
  // Estadísticas de productos parseados
  const stats = useMemo(() => {
    const valid = parsedProducts.filter(p => p.isValid).length;
    const invalid = parsedProducts.filter(p => !p.isValid).length;
    return { valid, invalid, total: parsedProducts.length };
  }, [parsedProducts]);

  // --- HANDLERS ---

  // Normalizar nombre de columna
  const normalizeColumnName = (name: string): string => {
    const normalized = name.toLowerCase().trim().replace(/\s+/g, '_');
    return COLUMN_MAPPINGS[normalized] || normalized;
  };

  // Validar un producto
  const validateProduct = (row: Record<string, unknown>, rowIndex: number): ParsedProduct => {
    const errors: string[] = [];
    
    // Mapear columnas
    const mappedRow: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      const normalizedKey = normalizeColumnName(key);
      mappedRow[normalizedKey] = value;
    });

    // Extraer valores
    const nombre_producto = sanitizeText(String(mappedRow.nombre_producto || '').trim());
    const descripcion = sanitizeText(String(mappedRow.descripcion || '').trim());
    const precioRaw = mappedRow.precio;
    const stockRaw = mappedRow.stock;
    const categoria = sanitizeText(String(mappedRow.categoria || '').trim());
    const proveedor = mappedRow.proveedor ? sanitizeText(String(mappedRow.proveedor).trim()) : undefined;
    const sku = mappedRow.sku ? sanitizeText(String(mappedRow.sku).trim()) : undefined;

    // Validar nombre (obligatorio)
    if (!nombre_producto) {
      errors.push('Nombre del producto es obligatorio');
    }

    // Validar precio (obligatorio y numérico)
    let precio = 0;
    if (precioRaw === undefined || precioRaw === null || precioRaw === '') {
      errors.push('Precio es obligatorio');
    } else {
      precio = parseFloat(String(precioRaw).replace(',', '.'));
      if (isNaN(precio) || precio < 0) {
        errors.push('Precio debe ser un número válido mayor o igual a 0');
      }
    }

    // Validar stock (obligatorio y numérico entero)
    let stock = 0;
    if (stockRaw === undefined || stockRaw === null || stockRaw === '') {
      errors.push('Stock es obligatorio');
    } else {
      stock = parseInt(String(stockRaw), 10);
      if (isNaN(stock) || stock < 0) {
        errors.push('Stock debe ser un número entero válido mayor o igual a 0');
      }
    }

    return {
      rowIndex,
      nombre_producto,
      descripcion,
      precio,
      stock,
      categoria,
      proveedor,
      sku,
      isValid: errors.length === 0,
      errors,
    };
  };

  // Procesar archivo Excel/CSV
  const processFile = async (selectedFile: File) => {
    setIsProcessing(true);
    setFile(selectedFile);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Tomar la primera hoja
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convertir a JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

      if (jsonData.length === 0) {
        toast.error('El archivo está vacío');
        setIsProcessing(false);
        return;
      }

      // Validar cada fila
      const products = jsonData.map((row, index) => validateProduct(row, index + 2)); // +2 porque Excel empieza en 1 y hay header

      setParsedProducts(products);
      setStep('preview');
      toast.success(`Se detectaron ${products.length} productos`);
    } catch (error) {
      console.error('Error procesando archivo:', error);
      toast.error('Error al procesar el archivo. Verifica el formato.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Manejar drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const extension = droppedFile.name.split('.').pop()?.toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
        processFile(droppedFile);
      } else {
        toast.error('Formato no soportado. Usa .xlsx, .xls o .csv');
      }
    }
  }, []);

  // Manejar selección de archivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  // Importar productos a Supabase
  const handleImport = async () => {
    if (!user) {
      toast.error('Debes estar autenticado');
      return;
    }

    const validProducts = parsedProducts.filter(p => p.isValid);
    if (validProducts.length === 0) {
      toast.error('No hay productos válidos para importar');
      return;
    }

    setIsImporting(true);
    setStep('importing');
    setImportProgress(0);

    const result: ImportResult = { success: 0, failed: 0, errors: [] };
    const batchSize = 50; // Insertar en lotes de 50
    const batches = [];

    // Dividir en lotes
    for (let i = 0; i < validProducts.length; i += batchSize) {
      batches.push(validProducts.slice(i, i + batchSize));
    }

    // Procesar cada lote
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        const productsToInsert = batch.map(p => ({
          user_id: user.id,
          name: p.nombre_producto,
          description: p.descripcion || null,
          price_usd: p.precio,
          stock: p.stock,
          category: p.categoria || null,
        }));

        const { data, error } = await supabase
          .from('products')
          .insert(productsToInsert)
          .select();

        if (error) {
          // Si hay error en el lote, intentar uno por uno
          for (const product of productsToInsert) {
            const { error: singleError } = await supabase
              .from('products')
              .insert(product);
            
            if (singleError) {
              result.failed++;
              result.errors.push({
                row: batch.find(b => b.nombre_producto === product.name)?.rowIndex || 0,
                product: product.name,
                error: singleError.message,
              });
            } else {
              result.success++;
            }
          }
        } else {
          result.success += data?.length || batch.length;
        }
      } catch (error) {
        result.failed += batch.length;
        batch.forEach(p => {
          result.errors.push({
            row: p.rowIndex,
            product: p.nombre_producto,
            error: 'Error de conexión',
          });
        });
      }

      // Actualizar progreso
      setImportProgress(Math.round(((i + 1) / batches.length) * 100));
    }

    setImportResult(result);
    setIsImporting(false);
    setStep('complete');

    if (result.success > 0) {
      toast.success(`${result.success} productos importados correctamente`);
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} productos fallaron`);
    }
  };

  // Reiniciar estado
  const handleReset = () => {
    setFile(null);
    setParsedProducts([]);
    setImportProgress(0);
    setImportResult(null);
    setStep('upload');
  };

  // Descargar reporte de errores
  const downloadErrorReport = () => {
    if (!importResult || importResult.errors.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(importResult.errors);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Errores');
    XLSX.writeFile(workbook, 'errores_importacion.xlsx');
  };

  // --- RENDER ---
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Acceso Denegado</h2>
              <p className="text-muted-foreground">
                Esta funcionalidad es exclusiva para administradores.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gradient-gold">Importar Productos</h1>
          <p className="text-muted-foreground mt-1">
            Carga masiva de productos desde archivos Excel o CSV
          </p>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-center gap-2 py-4">
          {['upload', 'preview', 'importing', 'complete'].map((s, index) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step === s 
                  ? "bg-primary text-primary-foreground" 
                  : ['upload', 'preview', 'importing', 'complete'].indexOf(step) > index
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}>
                {index + 1}
              </div>
              {index < 3 && (
                <div className={cn(
                  "w-12 h-0.5 mx-1",
                  ['upload', 'preview', 'importing', 'complete'].indexOf(step) > index
                    ? "bg-primary"
                    : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* PASO 1: Subida de archivo */}
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Subir Archivo
                  </CardTitle>
                  <CardDescription>
                    Arrastra un archivo Excel (.xlsx, .xls) o CSV, o haz clic para seleccionar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer",
                      isDragging 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-primary/50 hover:bg-secondary"
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                      disabled={isProcessing}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {isProcessing ? (
                        <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                      ) : (
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      )}
                      <p className="text-lg font-medium">
                        {isProcessing ? 'Procesando...' : 'Arrastra tu archivo aquí'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        o haz clic para seleccionar
                      </p>
                    </label>
                  </div>

                  {/* Formato esperado */}
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Columnas esperadas:</h4>
                    <div className="flex flex-wrap gap-2">
                      {['nombre_producto*', 'precio*', 'stock*', 'descripcion', 'categoria', 'proveedor', 'sku'].map(col => (
                        <div key={col}>
                          <Badge variant={col.includes('*') ? 'default' : 'secondary'}>
                            {col}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">* Campos obligatorios</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* PASO 2: Previsualización */}
          {step === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Info del archivo */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{file?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {file && (file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleReset}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Estadísticas */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-primary">{stats.valid}</p>
                    <p className="text-sm text-muted-foreground">Válidos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-destructive">{stats.invalid}</p>
                    <p className="text-sm text-muted-foreground">Con errores</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabla de previsualización */}
              <Card>
                <CardHeader>
                  <CardTitle>Previsualización</CardTitle>
                  <CardDescription>
                    Revisa los productos antes de importar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Fila</th>
                          <th className="p-2 text-left">Estado</th>
                          <th className="p-2 text-left">Nombre</th>
                          <th className="p-2 text-left">Precio</th>
                          <th className="p-2 text-left">Stock</th>
                          <th className="p-2 text-left">Categoría</th>
                          <th className="p-2 text-left">Errores</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedProducts.map((product, index) => (
                          <tr 
                            key={index} 
                            className={cn(
                              "border-b",
                              !product.isValid && "bg-destructive/5"
                            )}
                          >
                            <td className="p-2">{product.rowIndex}</td>
                            <td className="p-2">
                              {product.isValid ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              )}
                            </td>
                            <td className="p-2 font-medium">{product.nombre_producto || '-'}</td>
                            <td className="p-2">${product.precio.toFixed(2)}</td>
                            <td className="p-2">{product.stock}</td>
                            <td className="p-2">{product.categoria || '-'}</td>
                            <td className="p-2">
                              {product.errors.length > 0 && (
                                <span className="text-destructive text-xs">
                                  {product.errors.join(', ')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Acciones */}
              <div className="flex gap-4 justify-end">
                <Button variant="outline" onClick={handleReset}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={stats.valid === 0}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Importar {stats.valid} productos
                </Button>
              </div>
            </motion.div>
          )}

          {/* PASO 3: Importando */}
          {step === 'importing' && (
            <motion.div
              key="importing"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin mb-6" />
                  <h3 className="text-xl font-semibold mb-2">Importando productos...</h3>
                  <p className="text-muted-foreground mb-6">
                    Por favor no cierres esta página
                  </p>
                  <div className="max-w-md mx-auto">
                    <Progress value={importProgress} className="h-3" />
                    <p className="text-sm text-muted-foreground mt-2">{importProgress}%</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* PASO 4: Completado */}
          {step === 'complete' && importResult && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  {importResult.success > 0 ? (
                    <CheckCircle2 className="h-16 w-16 mx-auto text-primary mb-6" />
                  ) : (
                    <XCircle className="h-16 w-16 mx-auto text-destructive mb-6" />
                  )}
                  <h3 className="text-xl font-semibold mb-2">Importación completada</h3>
                  <div className="flex justify-center gap-8 mt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">{importResult.success}</p>
                      <p className="text-sm text-muted-foreground">Importados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-destructive">{importResult.failed}</p>
                      <p className="text-sm text-muted-foreground">Fallidos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Errores si los hay */}
              {importResult.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-destructive">Errores de importación</CardTitle>
                    <CardDescription>
                      Los siguientes productos no pudieron importarse
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[200px] overflow-y-auto">
                      {importResult.errors.map((err, index) => (
                        <div key={index} className="flex justify-between py-2 border-b text-sm">
                          <span>Fila {err.row}: {err.product}</span>
                          <span className="text-destructive">{err.error}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      variant="outline" 
                      className="mt-4 gap-2"
                      onClick={downloadErrorReport}
                    >
                      <Download className="h-4 w-4" />
                      Descargar reporte de errores
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Acciones finales */}
              <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={handleReset}>
                  Importar más productos
                </Button>
                <Button onClick={() => window.location.href = '/products'}>
                  Ver productos
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
}
