const { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Optional: electron-updater (may not be bundled in production)
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  // electron-updater not available
}

// ========== LOGGING ==========
let logFile = null;
const getLogFile = () => {
  if (!logFile) {
    try {
      logFile = path.join(app.getPath('userData'), 'app.log');
    } catch (e) {
      // App not ready yet, use temp directory
      logFile = path.join(require('os').tmpdir(), 'cygnus-md.log');
    }
  }
  return logFile;
};

const log = (level, message, ...args) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message} ${args.length ? JSON.stringify(args) : ''}\n`;

  // Console output in dev
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log(logMessage.trim());
  }

  // File output in production
  try {
    fs.appendFileSync(getLogFile(), logMessage);
  } catch (e) {
    // Ignore file write errors
  }
};

const logger = {
  info: (msg, ...args) => log('info', msg, ...args),
  warn: (msg, ...args) => log('warn', msg, ...args),
  error: (msg, ...args) => log('error', msg, ...args),
};

// Load environment variables
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
  // dotenv not available in production build, that's ok
}

// ========== SENTRY ERROR TRACKING (Optional) ==========
try {
  const Sentry = require('@sentry/electron/main');
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      enabled: !process.env.VITE_DEV_SERVER_URL,
    });
    logger.info('Sentry initialized');
  }
} catch (e) {
  // Sentry not available in production build, continue without it
  logger.warn('Sentry not available, continuing without error tracking');
}

// ========== AUTO-UPDATER SETUP (Optional) ==========
if (autoUpdater) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available:', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info('App is up to date:', info.version);
  });

  autoUpdater.on('download-progress', (progress) => {
    logger.info(`Download progress: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded:', info.version);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'The update will be installed when you restart the application.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    }
  });

  autoUpdater.on('error', (error) => {
    logger.error('Auto-updater error:', error.message);
  });
} else {
  logger.warn('Auto-updater not available');
}

// ========== ELECTRON NUCLEAR DIET MODE ==========
// Disable EVERYTHING we don't need for a markdown reader

// Kill all the heavy features
app.commandLine.appendSwitch('disable-features', [
  'Bluetooth', 'WebBluetooth', 'WebBluetoothScanning',
  'MediaDevicesSystemMonitor', 'AudioServiceOutOfProcess', 'GlobalMediaControls',
  'TranslateUI', 'AutofillServerCommunication', 'SafeBrowsing',
  'OptimizationHints', 'MediaRouter', 'DialMediaRouteProvider',
  'AcceptCHFrame', 'AutoExpandDetailsElement', 'CertificateTransparencyComponentUpdater',
  'AvoidUnnecessaryBeforeUnloadCheckSync', 'Vulkan'
].join(','));

// Disable all the things
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-client-side-phishing-detection');
app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-hang-monitor');
app.commandLine.appendSwitch('disable-ipc-flooding-protection');
app.commandLine.appendSwitch('disable-popup-blocking');
app.commandLine.appendSwitch('disable-prompt-on-repost');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-translate');
app.commandLine.appendSwitch('disable-speech-api');
app.commandLine.appendSwitch('disable-spell-checking');
app.commandLine.appendSwitch('disable-notifications');
app.commandLine.appendSwitch('disable-logging');

// Skip startup checks
app.commandLine.appendSwitch('no-first-run');
app.commandLine.appendSwitch('no-default-browser-check');
app.commandLine.appendSwitch('no-pings');
app.commandLine.appendSwitch('no-proxy-server');

// Disable metrics/telemetry
app.commandLine.appendSwitch('metrics-recording-only');
app.commandLine.appendSwitch('disable-machine-cert-request');

// GPU/rendering - ENABLE hardware acceleration for smooth rendering
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,single-on-top,underlay');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,VaapiVideoEncoder');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');

// ========== APPLICATION MENU WITH KEYBOARD SHORTCUTS ==========
const createAppMenu = () => {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!mainWindow) return;
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              const content = fs.readFileSync(filePath, 'utf-8');
              const fileName = path.basename(filePath);
              mainWindow.webContents.send('open-file', { filePath, content, fileName });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Export to PDF',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('export-pdf');
          }
        },
        { type: 'separator' },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (mainWindow) mainWindow.close();
          }
        },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        },
        {
          label: 'Toggle TOC',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('toggle-toc');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 2.0));
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.5));
            }
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.setZoomFactor(1.0);
            }
          }
        }
      ]
    },
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Next Page',
          accelerator: 'Right',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('navigate-page', 'next');
          }
        },
        {
          label: 'Previous Page',
          accelerator: 'Left',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('navigate-page', 'prev');
          }
        }
      ]
    }
  ];

  // Help menu
  template.push({
    label: 'Help',
    submenu: [
      {
        label: 'Check for Updates',
        enabled: !!autoUpdater,
        click: async () => {
          if (!autoUpdater) return;
          try {
            const result = await autoUpdater.checkForUpdates();
            if (!result || !result.updateInfo) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'No Updates',
                message: 'You are using the latest version.',
              });
            }
          } catch (error) {
            logger.error('Manual update check failed:', error.message);
            dialog.showMessageBox(mainWindow, {
              type: 'error',
              title: 'Update Check Failed',
              message: 'Could not check for updates.',
              detail: error.message,
            });
          }
        }
      },
      { type: 'separator' },
      {
        label: 'About Cygnus MD',
        click: () => {
          const version = app.getVersion();
          const electronVersion = process.versions.electron;
          const chromeVersion = process.versions.chrome;
          const nodeVersion = process.versions.node;

          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About Cygnus MD',
            message: 'Cygnus MD',
            detail: [
              `Version: ${version}`,
              '',
              `Electron: ${electronVersion}`,
              `Chrome: ${chromeVersion}`,
              `Node.js: ${nodeVersion}`,
              '',
              'A beautiful paginated Markdown reader.',
              '',
              '© 2024 Rizky Andriawan',
            ].join('\n'),
          });
        }
      },
      { type: 'separator' },
      {
        label: 'Open Log File',
        click: () => {
          shell.showItemInFolder(getLogFile());
        }
      }
    ]
  });

  // Add dev tools in development
  if (isDev) {
    template.push({
      label: 'Developer',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (e) {
  // electron-squirrel-startup not available on non-Windows platforms
}

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let mainWindow;
let splashWindow;
let fileToOpen = null;

// ========== SINGLE INSTANCE LOCK ==========
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit();
} else {
  // Handle second instance trying to open
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Focus the main window if it exists
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Check if second instance was opened with a file argument
      const secondArgs = commandLine.slice(isDev ? 2 : 1);
      for (const arg of secondArgs) {
        if (arg.endsWith('.md') || arg.endsWith('.markdown') || arg.endsWith('.txt')) {
          const resolvedPath = path.resolve(workingDirectory, arg);
          if (fs.existsSync(resolvedPath)) {
            // Open the file in the existing window
            try {
              const content = fs.readFileSync(resolvedPath, 'utf-8');
              const fileName = path.basename(resolvedPath);
              mainWindow.webContents.send('open-file', { filePath: resolvedPath, content, fileName });
            } catch (err) {
              console.error('Failed to open file from second instance:', err);
            }
            break;
          }
        }
      }
    }
  });
}

// Parse command line arguments for file to open
const args = process.argv.slice(isDev ? 2 : 1);
for (const arg of args) {
  if (arg.endsWith('.md') || arg.endsWith('.markdown') || arg.endsWith('.txt')) {
    const resolvedPath = path.resolve(arg);
    if (fs.existsSync(resolvedPath)) {
      fileToOpen = resolvedPath;
      break;
    }
  }
}

const createSplashWindow = () => {
  splashWindow = new BrowserWindow({
    width: 300,
    height: 350,
    frame: false,
    resizable: false,
    center: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#1e1b4b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In production, use app.getAppPath() for asar paths
  const splashPath = isDev
    ? path.join(__dirname, 'splash.html')
    : path.join(app.getAppPath(), 'electron', 'splash.html');

  splashWindow.loadFile(splashPath);
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Frameless window
    icon: path.join(__dirname, '../build/icon.png'),
    show: false, // Don't show until ready
    backgroundColor: '#1e1b4b', // Prevent white flash - dark purple
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      devTools: isDev,
    },
  });

  // Show window when ready, close splash
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();

    // Open file from command line argument
    if (fileToOpen) {
      setTimeout(() => {
        try {
          const content = fs.readFileSync(fileToOpen, 'utf-8');
          const fileName = path.basename(fileToOpen);
          logger.info('Opening file from CLI:', fileToOpen);
          mainWindow.webContents.send('open-file', { filePath: fileToOpen, content, fileName });
        } catch (err) {
          logger.error('Failed to open file:', err.message);
        }
      }, 500); // Small delay to ensure renderer is ready
    }
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }

  // Custom right-click context menu (Copy only)
  mainWindow.webContents.on('context-menu', (event, params) => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Copy',
        role: 'copy',
        enabled: params.selectionText.length > 0,
      },
    ]);
    contextMenu.popup();
  });

  // ========== SECURITY HARDENING ==========

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    // Allow only local dev server or file protocol
    if (isDev && parsedUrl.origin === 'http://localhost:1420') return;
    if (parsedUrl.protocol === 'file:') return;
    event.preventDefault();
  });

  // Prevent new window creation (popups)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Set Content Security Policy (production only - dev needs looser CSP for HMR)
  if (!isDev) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: local-file: file:",
            "font-src 'self' data:",
            "connect-src 'self'",
          ].join('; ')
        }
      });
    });
  }
};

// Register custom protocol for local files
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
]);

app.whenReady().then(() => {
  logger.info('App ready, version:', app.getVersion());

  // Handle local file protocol
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''));
    return net.fetch(url.pathToFileURL(filePath).toString());
  });

  // Create application menu with shortcuts
  createAppMenu();

  // Show splash screen first, then create main window
  createSplashWindow();
  createWindow();

  // Check for updates in production (after a short delay)
  if (!isDev && autoUpdater) {
    setTimeout(() => {
      logger.info('Checking for updates on startup...');
      autoUpdater.checkForUpdates().catch((err) => {
        logger.error('Startup update check failed:', err.message);
      });
    }, 3000);
  }

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

// IPC Handlers

// Open file dialog
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  return { filePath, content, fileName };
});

// Read file
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
});

// Check if file exists
ipcMain.handle('fs:exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

// Convert file path to local-file:// URL
ipcMain.handle('fs:getFileUrl', async (event, filePath) => {
  return `local-file://${encodeURIComponent(filePath)}`;
});

// Set window title
ipcMain.handle('window:setTitle', async (event, title) => {
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});

// Window controls
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Export to PDF using hidden window
ipcMain.handle('export:pdf', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No window' };

  const { html, fileName = 'document.pdf' } = options;

  if (!html) {
    return { success: false, error: 'No HTML content provided' };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export to PDF',
    defaultPath: fileName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  let printWindow = null;

  try {
    logger.info('PDF export: HTML length:', html.length);

    // Debug: save HTML to temp file
    const debugPath = path.join(app.getPath('temp'), 'cygnus-pdf-debug.html');
    fs.writeFileSync(debugPath, html, 'utf-8');
    logger.info('PDF export: Debug HTML saved to:', debugPath);

    // Create hidden window for PDF generation
    printWindow = new BrowserWindow({
      width: 794,  // A4 width at 96 DPI
      height: 1123, // A4 height at 96 DPI
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Load HTML content - use base64 to avoid encoding issues
    const base64HTML = Buffer.from(html, 'utf-8').toString('base64');
    await printWindow.loadURL(`data:text/html;base64,${base64HTML}`);

    logger.info('PDF export: HTML loaded in hidden window');

    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate PDF
    const pdfData = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    fs.writeFileSync(result.filePath, pdfData);
    logger.info('PDF exported:', result.filePath);

    return { success: true, filePath: result.filePath };
  } catch (error) {
    logger.error('PDF export failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
  }
});

// Export to DOCX
ipcMain.handle('export:docx', async (event, options = {}) => {
  const { data, fileName = 'document.docx' } = options;

  const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
    title: 'Export to DOCX',
    defaultPath: fileName,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  try {
    // Convert base64 back to buffer
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    logger.info('DOCX exported:', result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (error) {
    logger.error('DOCX export failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Renderer logging
ipcMain.on('renderer:log', (event, { level, message, args }) => {
  logger[level] ? logger[level](`[Renderer] ${message}`, ...args) : logger.info(`[Renderer] ${message}`, ...args);
});
