import { render, RenderOptions, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { AllProviders } from './Providers';

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

export { screen };
export { customRender as render };
