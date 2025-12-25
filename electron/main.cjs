const { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

// ========== ELECTRON DIET MODE ==========

// Disable unnecessary Chromium features
app.commandLine.appendSwitch('disable-spell-checking');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Remove default menu
Menu.setApplicationMenu(null);

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

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Frameless window
    show: false, // Don't show until ready
    backgroundColor: '#1a202c', // Prevent white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      devTools: isDev,
    },
  });

  // Show window when ready (smoother startup)
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
};

// Register custom protocol for local files
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
]);

app.whenReady().then(() => {
  // Handle local file protocol
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''));
    return net.fetch(url.pathToFileURL(filePath).toString());
  });

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
