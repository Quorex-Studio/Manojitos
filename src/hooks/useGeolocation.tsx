import { useState } from 'react';
import { useToast } from './use-toast';

interface GeolocationResult {
  coordsStr: string;
  addressString: string;
}

export function useGeolocation() {
  const [gettingGPS, setGettingGPS] = useState(false);
  const { toast } = useToast();

  const handleGetLocation = (onSuccess: (result: GeolocationResult) => void) => {
    if (!navigator.geolocation) {
      toast({
        title: 'Error de ubicación',
        description: 'Tu navegador no permite capturar la ubicación por GPS.',
        variant: 'destructive'
      });
      return;
    }

    setGettingGPS(true);

    const successCallback = (position: any) => {
      const { latitude, longitude } = position.coords;
      const coordsStr = `${latitude},${longitude}`;
      onSuccess({
        coordsStr,
        addressString: `Ubicación GPS: ${coordsStr}`
      });
      setGettingGPS(false);
      toast({
        title: 'Ubicación obtenida',
        description: 'Coordenadas GPS registradas con éxito.'
      });
    };

    const getIPLocation = async () => {
      console.log('Starting IP geolocation fallbacks...');

      // 1. Intentar con ipwho.is (CORS y HTTPS gratuito)
      try {
        console.log('Querying ipwho.is...');
        const response = await fetch('https://ipwho.is/');
        if (response.ok) {
          const data = await response.json();
          if (data && data.success && data.latitude && data.longitude) {
            const coordsStr = `${data.latitude},${data.longitude}`;
            onSuccess({
              coordsStr,
              addressString: `Ubicación estimada: ${data.city || ''}, ${data.region || ''}, ${data.country || ''}`.trim()
            });
            setGettingGPS(false);
            toast({
              title: 'Ubicación aproximada obtenida',
              description: 'Se usó tu dirección de red para estimar tu ubicación.'
            });
            return;
          }
        }
      } catch (err) {
        console.log('ipwho.is query failed:', err);
      }

      // 2. Intentar con freeipapi.com (CORS y HTTPS gratuito)
      try {
        console.log('Querying freeipapi.com...');
        const response = await fetch('https://freeipapi.com/api/json');
        if (response.ok) {
          const data = await response.json();
          if (data && data.latitude && data.longitude) {
            const coordsStr = `${data.latitude},${data.longitude}`;
            onSuccess({
              coordsStr,
              addressString: `Ubicación estimada: ${data.cityName || ''}, ${data.regionName || ''}, ${data.countryName || ''}`.trim()
            });
            setGettingGPS(false);
            toast({
              title: 'Ubicación aproximada obtenida',
              description: 'Se usó tu dirección de red para estimar tu ubicación.'
            });
            return;
          }
        }
      } catch (err) {
        console.log('freeipapi.com query failed:', err);
      }

      // 3. Intentar con ipapi.co (CORS y HTTPS gratuito)
      try {
        console.log('Querying ipapi.co...');
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          if (data && !data.error && data.latitude && data.longitude) {
            const coordsStr = `${data.latitude},${data.longitude}`;
            onSuccess({
              coordsStr,
              addressString: `Ubicación estimada: ${data.city || ''}, ${data.region || ''}, ${data.country_name || ''}`.trim()
            });
            setGettingGPS(false);
            toast({
              title: 'Ubicación aproximada obtenida',
              description: 'Se usó tu dirección de red para estimar tu ubicación.'
            });
            return;
          }
        }
      } catch (err) {
        console.log('ipapi.co query failed:', err);
      }

      // Si todo falla, mostrar error manual
      console.log('All IP geolocation fallbacks failed.');
      setGettingGPS(false);
      toast({
        title: 'Error de ubicación',
        description: 'No se pudo obtener la ubicación exacta. Por favor, escríbela o introduce las coordenadas manualmente.',
        variant: 'destructive'
      });
    };

    const errorCallbackLow = (error: any) => {
      console.error('Low accuracy geolocation failed:', error);
      // Intentar geolocalización por IP como recurso automático final
      getIPLocation();
    };

    const errorCallbackHigh = (error: any) => {
      if (error.code === 1) { // PERMISSION_DENIED
        setGettingGPS(false);
        toast({
          title: 'Permiso de ubicación denegado',
          description: 'No se pudo acceder al GPS porque los permisos están desactivados en tu navegador. Por favor, escribe tu dirección o introduce las coordenadas manualmente.',
          variant: 'destructive'
        });
        return;
      }

      console.warn('High accuracy geolocation failed, retrying with low accuracy...', error);
      navigator.geolocation.getCurrentPosition(
        successCallback,
        errorCallbackLow,
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    // Intentar primero con alta precisión y un timeout más corto (5s)
    navigator.geolocation.getCurrentPosition(
      successCallback,
      errorCallbackHigh,
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  return { gettingGPS, handleGetLocation };
}
