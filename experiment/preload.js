const { contextBridge, ipcRenderer } = require('electron')
const path = require('path')
const os = require('os')

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld(
  'electron', {
    saveFile: (data) => ipcRenderer.invoke('save-file', data),
    createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
    getAppDataPath: () => {
      return path.join(os.homedir(), '手语实验数据')
    }
  }
)
