import { useEffect, useState } from 'react';

function getRuntimeLabel() {
  if (typeof window === 'undefined') {
    return {
      appName: 'Balance',
      environmentLabel: 'LOCAL'
    };
  }

  return window.balanceDesktop.runtime;
}

export function App() {
  const runtime = getRuntimeLabel();
  const [apiBaseUrl, setApiBaseUrl] = useState('Loading API connection...');
  const [healthPayload, setHealthPayload] = useState('Health status not checked yet');

  useEffect(() => {
    void window.balanceDesktop.getApiBaseUrl().then(setApiBaseUrl);
  }, []);

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: 32 }}>
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 24,
          padding: 28,
          boxShadow: '0 20px 60px rgba(2, 6, 23, 0.45)'
        }}
      >
        <div style={{ marginBottom: 12, fontSize: 12, letterSpacing: '0.18em', color: '#67e8f9' }}>
          {runtime.appName.toUpperCase()} DESKTOP · DOCUMENT WORKFLOW PLATFORM
        </div>
        <h1 style={{ margin: 0, fontSize: 38 }}>{runtime.appName} Desktop Workspace</h1>
        <p style={{ color: '#cbd5e1', lineHeight: 1.7 }}>
          A secure desktop workspace for monitoring document workflow services and checking API connectivity.
        </p>

        <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
          <div>
            <strong>Environment:</strong> {runtime.environmentLabel}
          </div>
          <div>
            <strong>API base URL:</strong> {apiBaseUrl}
          </div>
          <button
            type="button"
            style={{
              width: 'fit-content',
              border: '1px solid rgba(34, 211, 238, 0.25)',
              borderRadius: 999,
              background: 'rgba(34, 211, 238, 0.12)',
              color: '#cffafe',
              padding: '10px 16px'
            }}
            onClick={async () => setHealthPayload(await window.balanceDesktop.pingHealth())}
          >
            Check API health
          </button>
          <pre
            style={{
              margin: 0,
              overflowX: 'auto',
              borderRadius: 16,
              background: 'rgba(2, 6, 23, 0.75)',
              padding: 16,
              color: '#e2e8f0'
            }}
          >
            {healthPayload}
          </pre>
        </div>
      </section>
    </main>
  );
}
