const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载index.html
  mainWindow.loadFile('index.html');

  // 打开开发者工具（可选）
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// 处理保存文件的IPC通信
ipcMain.handle('save-file', async (event, { filePath, data }) => {
  try {
    const fs = require('fs');
    const buffer = Buffer.from(data);
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (error) {
    console.error('保存文件失败:', error);
    return { success: false, message: error.message };
  }
});
