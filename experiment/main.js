const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // 允许加载本地资源
    }
  })

  // 直接打开开发者工具，查看错误
  mainWindow.webContents.openDevTools()
  
  // 新的路径加载方式
  const indexPath = path.join(__dirname, 'index.html')
  console.log('尝试加载:', indexPath)
  mainWindow.loadFile(indexPath)

  // 移除菜单栏
  mainWindow.setMenuBarVisibility(false)
}

app.whenReady().then(() => {
  createWindow()
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// 处理文件保存
ipcMain.handle('save-file', async (event, { filePath, data }) => {
  try {
    const { canceled, filePaths } = await dialog.showSaveDialog({
      defaultPath: filePath,
      filters: [{ name: 'Zip文件', extensions: ['zip'] }]
    })
    
    if (canceled) {
      return { success: false, message: '用户取消' }
    }
    
    fs.writeFileSync(filePaths[0], Buffer.from(data))
    return { success: true, path: filePaths[0] }
  } catch (error) {
    console.error('保存文件错误:', error)
    return { success: false, message: error.message }
  }
})
