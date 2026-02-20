import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { registerEnvHandlers } from './env-manager.js';
import { interceptConsole } from './log-interceptor.js';
import { registerPipelineHandlers } from './pipeline-runner.js';

// Vite-generated references for renderer entry point
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: '獸醫課程 AI 生成系統',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development' || MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Intercept console for log streaming
  interceptConsole(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers
function registerAllHandlers(): void {
  registerEnvHandlers(ipcMain);
  registerPipelineHandlers(ipcMain);

  // File dialog handlers
  ipcMain.handle('file:open', async (_event, options: { filters?: Electron.FileFilter[] }) => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options.filters ?? [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('file:save', async (_event, options: { defaultPath?: string; filters?: Electron.FileFilter[] }) => {
    const { dialog } = await import('electron');
    const result = await dialog.showSaveDialog({
      defaultPath: options.defaultPath,
      filters: options.filters ?? [
        { name: 'JSON Files', extensions: ['json'] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  ipcMain.handle('file:read-json', async (_event, filePath: string) => {
    const { readFile } = await import('node:fs/promises');
    try {
      const content = await readFile(filePath, 'utf-8');
      return { success: true, data: JSON.parse(content) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}

app.whenReady().then(() => {
  registerAllHandlers();
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
