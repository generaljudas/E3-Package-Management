const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Add any Electron-specific APIs here if needed in the future
  isElectron: true,
  platform: process.platform
});

console.log('Preload script loaded');
