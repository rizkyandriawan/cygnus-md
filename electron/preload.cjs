const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  // File system
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  getFileUrl: (filePath) => ipcRenderer.invoke('fs:getFileUrl', filePath),

  // Window
  setTitle: (title) => ipcRenderer.invoke('window:setTitle', title),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Check if running in Electron
  isElectron: true,
});
