import { Link } from "react-router-dom";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";

// Página no encontrada: dentro de la tienda, con salida clara
const NotFound = () => (
  <StoreLayout>
    <div className="container mx-auto px-4 py-20 max-w-md text-center min-h-[55vh] flex flex-col items-center justify-center">
      <p className="font-serif text-6xl text-primary mb-4">404</p>
      <h1 className="font-serif text-2xl text-foreground mb-2">Esta página no existe</h1>
      <p className="text-muted-foreground mb-8">Puede que el enlace esté mal escrito o que el producto ya no esté disponible.</p>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Button asChild className="rounded-full"><Link to="/tienda">Ver la tienda</Link></Button>
        <Button asChild variant="outline" className="rounded-full"><Link to="/">Ir al inicio</Link></Button>
      </div>
    </div>
  </StoreLayout>
);

export default NotFound;
