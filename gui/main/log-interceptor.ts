import type { BrowserWindow } from 'electron';

/** Original console methods backup */
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

let intercepted = false;

/**
 * Intercept console.log, console.warn, console.error and forward to renderer via IPC.
 * This allows existing src/lib/ modules (which use console.log) to stream output to the GUI.
 */
export function interceptConsole(win: BrowserWindow): void {
  if (intercepted) return;
  intercepted = true;

  const sendLog = (level: string, args: unknown[]) => {
    try {
      if (win && !win.isDestroyed()) {
        win.webContents.send('pipeline:log', {
          level,
          message: args.map(a => {
            if (typeof a === 'string') return a;
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          }).join(' '),
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Silently ignore send errors (window may be closing)
    }
  };

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    sendLog('info', args);
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    sendLog('warn', args);
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    sendLog('error', args);
  };
}

/** Restore original console methods (useful for cleanup) */
export function restoreConsole(): void {
  if (!intercepted) return;
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  intercepted = false;
}
