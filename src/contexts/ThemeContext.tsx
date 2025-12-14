import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Tipos para el contexto de tema
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider del tema con persistencia en localStorage
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  // Inicializar tema desde localStorage o preferencia del sistema
  useEffect(() => {
    const storedTheme = localStorage.getItem('manojitos-theme') as Theme | null;
    
    if (storedTheme) {
      // Usar tema guardado
      setThemeState(storedTheme);
      document.documentElement.classList.toggle('dark', storedTheme === 'dark');
    } else {
      // Detectar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme: Theme = prefersDark ? 'dark' : 'light';
      setThemeState(systemTheme);
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, []);

  // Alternar entre modo claro y oscuro
  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    localStorage.setItem('manojitos-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Establecer tema específico
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('manojitos-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

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
