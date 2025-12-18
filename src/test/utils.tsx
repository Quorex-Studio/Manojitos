import { render, RenderOptions, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ReactElement, ReactNode } from 'react';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

interface WrapperProps {
  children: ReactNode;
}

function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

export { screen };
export { customRender as render };
