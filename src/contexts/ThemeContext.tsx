import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

// Tipos para el contexto de tema
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider del tema con persistencia en localStorage y transiciones suaves
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [isInitialized, setIsInitialized] = useState(false);

  // Inicializar tema desde localStorage o preferencia del sistema
  useEffect(() => {
    const storedTheme = localStorage.getItem('manojitos-theme') as Theme | null;
    
    if (storedTheme) {
      setThemeState(storedTheme);
      document.documentElement.classList.toggle('dark', storedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme: Theme = prefersDark ? 'dark' : 'light';
      setThemeState(systemTheme);
      document.documentElement.classList.toggle('dark', prefersDark);
    }
    setIsInitialized(true);
  }, []);

  // Aplicar transición suave al cambiar tema
  const applyThemeWithTransition = useCallback((newTheme: Theme) => {
    // Agregar clase para transición global
    document.documentElement.classList.add('theme-transitioning');
    
    // Aplicar el nuevo tema
    setThemeState(newTheme);
    localStorage.setItem('manojitos-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    
    // Remover clase de transición después de completar
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 350);
  }, []);

  // Alternar entre modo claro y oscuro
  const toggleTheme = useCallback(() => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    applyThemeWithTransition(newTheme);
  }, [theme, applyThemeWithTransition]);

  // Establecer tema específico
  const setTheme = useCallback((newTheme: Theme) => {
    applyThemeWithTransition(newTheme);
  }, [applyThemeWithTransition]);

  // Evitar flash de contenido durante la hidratación
  if (!isInitialized) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook para usar el contexto de tema
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
