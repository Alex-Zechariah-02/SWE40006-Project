import { contextBridge } from 'electron';
import { loadAppConfig } from '@balance/config';

const config = loadAppConfig();

contextBridge.exposeInMainWorld('balanceDesktop', {
  runtime: {
    appName: config.appName,
    environment: config.appEnv,
    environmentLabel: config.appEnv.toUpperCase()
  },
  async getApiBaseUrl() {
    return config.desktopApiBaseUrl;
  },
  async pingHealth() {
    const response = await fetch(`${config.desktopApiBaseUrl}/health`);
    return await response.text();
  }
});
