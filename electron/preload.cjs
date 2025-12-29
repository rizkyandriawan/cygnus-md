const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  // File system
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  openFilePath: (filePath) => ipcRenderer.invoke('fs:openFilePath', filePath),
  exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  getFileUrl: (filePath) => ipcRenderer.invoke('fs:getFileUrl', filePath),

  // Window
  setTitle: (title) => ipcRenderer.invoke('window:setTitle', title),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Listen for file open from main process
  onOpenFile: (callback) => ipcRenderer.on('open-file', (event, data) => callback(data)),

  // Listen for toggle TOC from menu
  onToggleToc: (callback) => ipcRenderer.on('toggle-toc', () => callback()),

  // Listen for page navigation from menu
  onNavigatePage: (callback) => ipcRenderer.on('navigate-page', (event, direction) => callback(direction)),

  // Export to PDF
  exportPdf: (options) => ipcRenderer.invoke('export:pdf', options),
  onExportPdf: (callback) => ipcRenderer.on('export-pdf', () => callback()),

  // Export to DOCX
  exportDocx: (options) => ipcRenderer.invoke('export:docx', options),

  // Export to HTML
  exportHtml: (options) => ipcRenderer.invoke('export:html', options),

  // Logging to main process
  log: (level, message, ...args) => ipcRenderer.send('renderer:log', { level, message, args }),

  // Check if running in Electron
  isElectron: true,
});
