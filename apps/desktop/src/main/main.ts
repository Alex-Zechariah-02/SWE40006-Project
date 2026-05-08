import path from 'node:path';

import { loadAppConfig } from '@balance/config';
import { app, BrowserWindow } from 'electron';

function createWindow() {
  const config = loadAppConfig();

  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    title: `${config.appName} Desktop Workspace · ${config.appEnv.toUpperCase()}`,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  void win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
