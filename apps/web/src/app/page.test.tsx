import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { RoutePlaceholderShell } from '../components/route-placeholder-shell';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('RoutePlaceholderShell', () => {
  it('renders the home experience with routing and proxy-friendly API paths', () => {
    process.env.APP_ENV = 'staging';
    process.env.API_PROXY_TARGET = 'http://api:3001';
    process.env.NEXT_PUBLIC_API_HEALTH_PATH = '/gateway/health';
    process.env.NEXT_PUBLIC_API_VERSION_PATH = '/gateway/version';

    const html = renderToStaticMarkup(
      <RoutePlaceholderShell
        routePath="/"
        routeTitle="Landing page"
        routeSummary="A public overview of the document workflow platform."
      />
    );

    expect(html).toContain('Balance');
    expect(html).toContain('Document workflow platform');
    expect(html).toContain('STAGING');
    expect(html).toContain('Current Route');
    expect(html).toContain('/login');
    expect(html).toContain('/app');
    expect(html).toContain('/gateway/health');
    expect(html).toContain('/gateway/version');
    expect(html).not.toContain('http://api:3001');
  });

  it('renders the login placeholder route', () => {
    process.env.APP_ENV = 'production';

    const html = renderToStaticMarkup(
      <RoutePlaceholderShell
        routePath="/login"
        routeTitle="Login page"
        routeSummary="A secure entry route for Balance users."
      />
    );

    expect(html).toContain('PRODUCTION');
    expect(html).toContain('/login');
    expect(html).toContain('Login page');
  });

  it('renders the app placeholder route', () => {
    process.env.APP_ENV = 'local';

    const html = renderToStaticMarkup(
      <RoutePlaceholderShell
        routePath="/app"
        routeTitle="Application workspace"
        routeSummary="A workspace route for document review and record management."
      />
    );

    expect(html).toContain('LOCAL');
    expect(html).toContain('/app');
    expect(html).toContain('Application workspace');
  });
});
