// app-bundle.js - CommonJS版本的app.js
(function(){
  // 加载依赖
  const ConfigManager = require('./config.js');
  const StorageManager = require('./storage.js');
  const VideoRecorder = require('./recorder.js');
  const ExperimentController = require('./experiment.js');
  require('../css/style.css');

  // 全局实验控制器
  class ExperimentApp {
    constructor() {
      try {
        console.log('初始化实验应用...');
        
        // 检查必要的DOM元素
        this.checkRequiredElements();
        
        // 初始化状态
        this.currentScreen = 'welcome';
        this.isRecording = false;
        this.isPractice = true;
        this.currentInstructionIndex = 0;
        
        // 初始化视频事件处理器引用
        this.currentVideoEndedHandler = null;
        this.videoLoadedHandler = null;
        
        // 初始化组件
        this.storage = new StorageManager();
        this.config = new ConfigManager();
        this.experiment = new ExperimentController(this.storage.getParticipantId());
        
        // 显式传递 storage 实例给 VideoRecorder
        this.recorder = new VideoRecorder(this.storage);
        
        // 初始化应用
        this.initializeApp().catch(error => {
          console.error('应用初始化失败:', error);
          this.showError('应用初始化失败: ' + error.message);
        });
        
      } catch (error) {
        console.error('实验应用初始化失败:', error);
        this.showError(`实验初始化失败: ${error.message}`);
        throw error;
      }
    }

    // ... 其余方法保持不变 ...

    // 导出数据
    async exportData() {
      try {
        console.log('开始导出数据...');
        const participantId = this.storage.getParticipantId();
        const results = this.experiment.getAllTrialResults();
        
        // 创建包含所有实验数据的zip文件
        const JSZip = window.JSZip;
        if (!JSZip) {
          throw new Error('JSZip库未加载，无法打包数据');
        }
        
        const zip = new JSZip();
        const resultsDir = `${participantId}_results`;
        const mainFolder = zip.folder(resultsDir);
        
        // 保存被试信息
        const participantInfo = this.storage.getParticipantInfo();
        const infoJson = JSON.stringify({
          participant_id: participantId,
          name: participantInfo.name,
          gender: participantInfo.gender,
          age: participantInfo.age,
          parent_deaf_count: participantInfo.deafParentsCount,
          recent_city: participantInfo.residenceCity,
          experiment_start_time: this.experiment.startTime || new Date().toISOString(),
          experiment_end_time: new Date().toISOString()
        }, null, 2);
        
        mainFolder.file(`${participantId}_info.json`, infoJson);
        console.log('添加被试信息到zip文件');
        
        // 保存实验数据
        const csvData = this.convertResultsToCSV(results);
        mainFolder.file(`${participantId}_exp.csv`, csvData);
        console.log('添加实验记录到zip文件');
        
        // 创建视频文件夹
        const videoFolder = mainFolder.folder(`${participantId}_video`);
        
        // 添加视频文件
        let totalVideos = 0;
        
        // 优先从内存缓存获取视频
        if (window.recordedVideos && window.recordedVideos.length > 0) {
          for (const video of window.recordedVideos) {
            if (video.blob && video.fileName) {
              videoFolder.file(video.fileName, video.blob);
              totalVideos++;
            }
          }
          console.log(`从内存缓存添加了 ${totalVideos} 个视频到zip文件`);
        }
        
        // 如果内存缓存不足，从IndexedDB获取
        if (totalVideos === 0) {
          try {
            const allVideos = await this.storage.getAllVideos();
            for (const video of allVideos) {
              if (video.path.includes(`${participantId}_video`) && video.data instanceof Blob) {
                const fileName = video.path.split('/').pop();
                videoFolder.file(fileName, video.data);
                totalVideos++;
              }
            }
            console.log(`从IndexedDB添加了 ${totalVideos} 个视频到zip文件`);
          } catch (error) {
            console.error('从IndexedDB获取视频失败:', error);
          }
        }
        
        // 生成zip文件
        console.log('正在生成zip文件...');
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 5 }
        });
        
        // 判断是否在Electron环境中
        if (window.electron) {
          try {
            const buffer = await zipBlob.arrayBuffer();
            const fileName = `${resultsDir}.zip`;
            const result = await window.electron.saveFile({
              filePath: fileName,
              data: buffer
            });
            
            if (result.success) {
              console.log('通过Electron API成功保存文件:', result.path);
              // 更新界面
              const exportBtn = document.getElementById('export-btn');
              if (exportBtn) {
                exportBtn.textContent = '数据已导出';
                exportBtn.disabled = true;
              }
              this.showSuccess(`所有实验数据已保存到 ${result.path}`);
              return true;
            } else {
              throw new Error(`保存失败: ${result.message}`);
            }
          } catch (error) {
            console.error('Electron保存文件失败:', error);
            // 回退到浏览器方法
          }
        }
        
        // 浏览器环境下载zip文件
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(zipBlob);
        downloadLink.download = `${resultsDir}.zip`;
        document.body.appendChild(downloadLink);
        
        console.log('开始下载实验数据包...');
        downloadLink.click();
        
        // 清理资源
        setTimeout(() => {
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(downloadLink.href);
        }, 100);
        
        // 更新界面
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
          exportBtn.textContent = '数据已导出';
          exportBtn.disabled = true;
        }
        
        this.showSuccess(`所有实验数据已保存到 ${resultsDir}.zip`);
        console.log('数据导出完成');
        return true;
      } catch (error) {
        console.error('导出数据失败:', error);
        this.showError('导出数据失败：' + error.message);
        return false;
      }
    }
  }

  // 页面加载完成后初始化实验
  window.addEventListener('load', () => {
    try {
      console.log('页面加载完成，开始初始化实验...');
      window.experimentApp = new ExperimentApp();
      console.log('实验应用初始化成功');
    } catch (error) {
      console.error('实验初始化失败:', error);
      // 显示错误信息
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 9999;
        text-align: center;
        max-width: 500px;
        word-wrap: break-word;
      `;
      errorDiv.innerHTML = `
        <h3>实验初始化失败</h3>
        <p>${error.message}</p>
        <p>请刷新页面重试，或联系实验员</p>
      `;
      document.body.appendChild(errorDiv);
    }
  });

  // 处理页面卸载事件
  window.addEventListener('beforeunload', () => {
    if (window.experimentApp) {
      window.experimentApp.handlePageUnload();
    }
  });

  // 处理页面关闭事件
  window.addEventListener('unload', () => {
    if (window.experimentApp) {
      window.experimentApp.cleanup();
    }
  });

  // 添加在原有app.js的末尾，用来支持Electron的文件保存
  if (window.electron) {
    console.log('检测到Electron环境，启用本地文件系统支持');
  }
})(); 