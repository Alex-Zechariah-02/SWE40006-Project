/// <reference types="vite/client" />

declare global {
  interface Window {
    balanceDesktop: {
      runtime: {
        appName: string;
        environment: 'local' | 'staging' | 'production';
        environmentLabel: string;
      };
      getApiBaseUrl: () => Promise<string>;
      pingHealth: () => Promise<string>;
    };
  }
}

export {};
