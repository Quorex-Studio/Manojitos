// Componente de etiqueta de producto con animación
import { motion } from 'framer-motion';
import { ProductLabel, useProductLabels } from '@/hooks/useProductLabels';

interface ProductLabelBadgeProps {
  label: ProductLabel;
  size?: 'sm' | 'md';
}

export function ProductLabelBadge({ label, size = 'sm' }: ProductLabelBadgeProps) {
  const sizeClasses = size === 'sm' 
    ? 'text-[10px] px-1.5 py-0.5' 
    : 'text-xs px-2 py-1';

  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={`${label.color} ${sizeClasses} rounded-full font-medium inline-flex items-center gap-1 shadow-sm`}
    >
      <span>{label.icon}</span>
      <span>{label.text}</span>
    </motion.span>
  );
}

interface ProductLabelsContainerProps {
  labels: ProductLabel[];
  maxLabels?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function ProductLabelsContainer({ 
  labels, 
  maxLabels = 3, 
  size = 'sm',
  className = ''
}: ProductLabelsContainerProps) {
  const visibleLabels = labels.slice(0, maxLabels);

  if (visibleLabels.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visibleLabels.map((label, index) => (
        <motion.div
          key={label.type}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: index * 0.1 }}
        >
          <ProductLabelBadge label={label} size={size} />
        </motion.div>
      ))}
    </div>
  );
}

// Nuevo componente wrapper que calcula etiquetas automáticamente
interface ProductForLabels {
  id: string;
  sold_count: number;
  stock: number;
  created_at: string;
  price_usd: number;
  category?: string | null;
}

interface AutoProductLabelsProps {
  product: ProductForLabels;
  allProducts?: ProductForLabels[];
  maxLabels?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function AutoProductLabels({ 
  product, 
  allProducts, 
  maxLabels = 3,
  size = 'sm',
  className = ''
}: AutoProductLabelsProps) {
  const labels = useProductLabels(product, allProducts);
  
  if (labels.length === 0) return null;
  
  return (
    <ProductLabelsContainer 
      labels={labels} 
      maxLabels={maxLabels} 
      size={size}
      className={className}
    />
  );
}
