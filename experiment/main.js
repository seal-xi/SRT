const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // 添加此行允许加载本地资源
    }
  });

  // 加载index.html
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // 添加开发工具便于调试
  mainWindow.webContents.openDevTools();
  
  // 移除菜单栏，让界面更简洁
  mainWindow.setMenuBarVisibility(false);
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

// 处理文件保存 - 使用对话框选择保存位置
ipcMain.handle('save-file', async (event, { filePath, data }) => {
  try {
    const { canceled, filePaths } = await dialog.showSaveDialog({
      defaultPath: filePath,
      filters: [{ name: 'Zip文件', extensions: ['zip'] }]
    });
    
    if (canceled) {
      return { success: false, message: '用户取消' };
    }
    
    fs.writeFileSync(filePaths[0], Buffer.from(data));
    return { success: true, path: filePaths[0] };
  } catch (error) {
    console.error('保存文件失败:', error);
    return { success: false, message: error.message };
  }
});

// 创建目录
ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return { success: true, path: dirPath };
  } catch (error) {
    return { success: false, message: error.message };
  }
});
