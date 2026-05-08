import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppShell } from './app-shell';
import { StatusCard } from './status-card';

describe('AppShell', () => {
  it('renders shared product framing and environment badge', () => {
    const html = renderToStaticMarkup(
      <AppShell
        appName="Balance"
        subtitle="Document workflow platform"
        environment="staging"
        description="Converts transaction documents into structured records."
      >
        <StatusCard title="API Health" value="Checking" detail="Waiting for /api/health" />
      </AppShell>
    );

    expect(html).toContain('Balance');
    expect(html).toContain('Document workflow platform');
    expect(html).toContain('STAGING');
    expect(html).toContain('API Health');
  });
});
