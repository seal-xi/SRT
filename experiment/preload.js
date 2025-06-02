// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  getAppPath: () => ipcRenderer.invoke('get-app-path')
});

// 将JSZip全局暴露，因为CSP阻止从CDN加载
try {
  const JSZip = require('jszip');
  contextBridge.exposeInMainWorld('JSZip', JSZip);
} catch (error) {
  console.error('无法加载JSZip:', error);
}
