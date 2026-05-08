import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App';

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow) {
    globalThis.window = originalWindow;
    return;
  }

  delete (globalThis as typeof globalThis & { window?: Window }).window;
});

describe('Desktop renderer App', () => {
  it('renders a public-safe desktop environment label', () => {
    globalThis.window = {
      balanceDesktop: {
        runtime: {
          appName: 'Balance',
          environment: 'staging',
          environmentLabel: 'STAGING'
        },
        getApiBaseUrl: async () => 'http://localhost:3001',
        pingHealth: async () => 'ok'
      }
    } as unknown as Window & typeof globalThis;

    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('Balance Desktop Workspace');
    expect(html).toContain('DOCUMENT WORKFLOW PLATFORM');
    expect(html).toContain('Environment');
    expect(html).toContain('STAGING');
  });
});
