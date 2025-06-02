class StorageManager {
    constructor(participantId = null) {
      // 每次运行程序都重新生成被试编号
      this.participantId = this.generateParticipantId();
      console.log('生成新的被试编号:', this.participantId);
      
      // 保存到 localStorage，但每次运行程序都会覆盖
      localStorage.setItem('handSignExp_participantId', this.participantId);
      
      this.progressKey = `handSignExp_progress_${this.participantId}`;
      this.dataKey = `handSignExp_data_${this.participantId}`;
      
      // 确保results文件夹存在
      this.ensureResultsFolder();
      
      this.participantInfo = null;
      this.db = null;
      this.initDB();
    }
    
    // 确保这个方法真正随机
    generateParticipantId() {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const now = new Date();
      const timestamp = now.getTime().toString().slice(-4); // 取时间戳后4位增加随机性
      let id = '';
      
      // 使用加强的随机方法
      const getRandomLetter = () => {
        const randomValues = new Uint8Array(1);
        window.crypto.getRandomValues(randomValues);
        return letters[randomValues[0] % letters.length];
      };
      
      // 生成5个随机字母
      for (let i = 0; i < 5; i++) {
        id += getRandomLetter();
      }
      
      return id;
    }
    
    // 获取当前编号
    getParticipantId() {
      // 尝试从 localStorage 获取
      const savedId = localStorage.getItem('handSignExp_participantId');
      if (savedId) {
        this.participantId = savedId;
      }
      return this.participantId;
    }
    
    // 尝试创建results文件夹
    ensureResultsFolder() {
      try {
        // 使用IndexedDB检查是否能写入数据
        // 这只是一个标记，表明我们已经尝试过创建文件夹
        localStorage.setItem('results_folder_check', 'true');
      } catch (e) {
        console.error('无法创建results文件夹检查标记', e);
      }
    }
    
    // 保存实验进度
    saveProgress(currentState, additionalData = {}) {
      const progressData = {
        participantId: this.participantId,
        currentState: currentState,
        ...additionalData,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(this.progressKey, JSON.stringify(progressData));
    }
    
    // 加载实验进度
    loadProgress() {
      const data = localStorage.getItem(this.progressKey);
      return data ? JSON.parse(data) : null;
    }
    
    // 初始化 IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("HandSignExperimentDB", 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // 创建存储视频的对象存储
                if (!db.objectStoreNames.contains('videos')) {
                    db.createObjectStore('videos', { keyPath: 'path' });
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB 初始化成功');
                resolve();
            };
            
            request.onerror = (event) => {
                console.error('IndexedDB 初始化失败', event);
                reject(new Error('数据库初始化失败'));
            };
        });
    }
    
    // 创建目录 (在IndexedDB中只是确保数据库连接正常)
    async createDirectory(path) {
        if (!this.db) {
            await this.initDB();
        }
        console.log(`创建目录: ${path} (模拟)`);
        return true;
    }
    
    // 保存文件到 IndexedDB
    async saveFile(path, content) {
        if (!this.db) {
            await this.initDB();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['videos'], 'readwrite');
            const store = transaction.objectStore('videos');
            
            const record = {
                path: path,
                data: content,
                timestamp: new Date().toISOString()
            };
            
            const request = store.put(record);
            
            request.onsuccess = () => {
                console.log(`文件保存成功: ${path}`);
                resolve(path);
            };
            
            request.onerror = (event) => {
                console.error('保存文件失败', event);
                reject(new Error('保存文件失败'));
            };
        });
    }
    
    // 获取所有保存的视频
    async getAllVideos() {
        if (!this.db) {
            await this.initDB();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['videos'], 'readonly');
            const store = transaction.objectStore('videos');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const videos = request.result;
                console.log(`从IndexedDB获取到 ${videos.length} 个文件`);
                resolve(videos);
            };
            
            request.onerror = (event) => {
                console.error('获取视频失败', event);
                reject(new Error('获取视频失败'));
            };
        });
    }
    
    // 导出所有实验数据和视频
    async exportAllData() {
        try {
            const videos = await this.getAllVideos();
            const experimentData = this.loadExperimentData();
            
            // 创建下载链接
            const zip = new JSZip();
            
            // 添加视频文件
            videos.forEach(video => {
                zip.file(video.path, video.data);
            });
            
            // 添加实验数据
            zip.file('experiment_data.json', JSON.stringify(experimentData, null, 2));
            
            // 生成并下载zip文件
            const content = await zip.generateAsync({type: 'blob'});
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `experiment_results_${this.participantId}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('导出数据失败:', error);
            throw error;
        }
    }
    
    // 保存被试信息
    saveParticipantInfo(info) {
        this.participantInfo = info;
        localStorage.setItem('participantInfo', JSON.stringify(info));
    }
    
    // 获取被试信息
    getParticipantInfo() {
        if (!this.participantInfo) {
            const savedInfo = localStorage.getItem('participantInfo');
            if (savedInfo) {
                this.participantInfo = JSON.parse(savedInfo);
            }
        }
        return this.participantInfo;
    }
    
    // 记录试次结果
    saveTrialResult(trialData) {
      const data = this.loadExperimentData() || {};
      
      // 初始化trials数组(如果不存在)
      if (!data.trials) {
        data.trials = [];
      }
      
      // 添加新的试次数据
      data.trials.push(trialData);
      
      // 保存到localStorage
      localStorage.setItem(this.dataKey, JSON.stringify(data));
      
      return trialData;
    }
    
    // 加载所有实验数据
    loadExperimentData() {
      const data = localStorage.getItem(this.dataKey);
      return data ? JSON.parse(data) : null;
    }
    
    // 保存视频文件
    async saveVideo(videoBlob, filename) {
      try {
        // 创建results文件夹（如果不存在）
        const resultsDir = 'results';
        if (!await this.checkDirectoryExists(resultsDir)) {
          await this.createDirectory(resultsDir);
        }
        
        // 创建被试文件夹
        const participantDir = `${resultsDir}/${this.participantId}`;
        if (!await this.checkDirectoryExists(participantDir)) {
          await this.createDirectory(participantDir);
        }
        
        // 创建videos文件夹
        const videosDir = `${participantDir}/videos`;
        if (!await this.checkDirectoryExists(videosDir)) {
          await this.createDirectory(videosDir);
        }
        
        // 保存视频文件
        const filePath = `${videosDir}/${filename}`;
        await this.saveFile(filePath, videoBlob);
        
        return filePath;
      } catch (error) {
        console.error('保存视频失败:', error);
        throw new Error('无法保存视频文件');
      }
    }
    
    // 检查目录是否存在
    async checkDirectoryExists(path) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        return true;
      } catch {
        return false;
      }
    }
    
    // 导出实验数据为JSON文件
    async exportDataAsJson() {
      try {
        const data = this.loadExperimentData();
        if (!data) {
          throw new Error('没有可导出的实验数据');
        }
        
        // 添加导出时间戳
        data.exportTimestamp = new Date().toISOString();
        
        // 创建JSON Blob
        const jsonBlob = new Blob([JSON.stringify(data, null, 2)], 
                                { type: 'application/json' });
        
        // 创建被试文件夹
        const participantDir = `results/${this.participantId}`;
        if (!await this.checkDirectoryExists(participantDir)) {
          await this.createDirectory(participantDir);
        }
        
        // 保存JSON文件
        const filePath = `${participantDir}/data.json`;
        await this.saveFile(filePath, jsonBlob);
        
        return true;
      } catch (error) {
        console.error('导出数据失败:', error);
        throw new Error('无法导出实验数据');
      }
    }
    
    // 清除所有数据
    clearAllData() {
      localStorage.removeItem(this.progressKey);
      localStorage.removeItem(this.dataKey);
    }

    async loadFile(path) {
      if (!this.db) {
        await this.initDB();
      }
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['videos'], 'readonly');
        const store = transaction.objectStore('videos');
        const request = store.get(path);
        
        request.onsuccess = () => {
          const record = request.result;
          if (record) {
            console.log(`成功加载文件: ${path}`);
            resolve(record.data);
          } else {
            console.warn(`找不到文件: ${path}`);
            resolve(null);
          }
        };
        
        request.onerror = (event) => {
          console.error(`加载文件失败: ${path}`, event);
          reject(new Error(`加载文件失败: ${path}`));
        };
      });
    }
    
    // 将结果转换为CSV格式
    convertResultsToCSV(results) {
      const headers = [
        'trial_id',               // 视频名称，如 M111
        'is_skipped',             // 跳过状态
        'is_repeated_trial',      // 是否为重复试次
        'trial_start_timestamp',  // 试次开始时间
        'trial_end_timestamp',    // 试次结束时间
        'recording_duration_s',   // 录像时长
        'recording_filepath',     // 录像路径
        'sequence'                // 播放顺序
      ];
      
      const rows = results.map(result => [
        result.trial_id || '',
        result.is_skipped || 0,
        result.is_repeated_trial || 0,
        result.trial_start_timestamp || '',
        result.trial_end_timestamp || '',
        result.recording_duration_s || 0,
        result.recording_filepath || 'N/A',
        result.sequence || ''
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    // 导出数据
    async exportData(experiment) {
      try {
        console.log('开始导出数据...');
        const participantId = this.getParticipantId();
        const results = experiment.getAllTrialResults();
        
        // 创建包含所有实验数据的zip文件
        const JSZip = window.JSZip;
        if (!JSZip) {
          throw new Error('JSZip库未加载，无法打包数据');
        }
        
        const zip = new JSZip();
        const resultsDir = `${participantId}_results`;
        const mainFolder = zip.folder(resultsDir);
        
        // 保存被试信息
        const participantInfo = this.getParticipantInfo();
        const infoJson = JSON.stringify({
          participant_id: participantId,
          name: participantInfo.name,
          gender: participantInfo.gender,
          age: participantInfo.age,
          parent_deaf_count: participantInfo.deafParentsCount,
          recent_city: participantInfo.residenceCity,
          experiment_start_time: experiment.startTime || new Date().toISOString(),
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
            const allVideos = await this.getAllVideos();
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
              return {
                success: true,
                path: result.path,
                message: `所有实验数据已保存到 ${result.path}`
              };
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
        
        return {
          success: true,
          path: `${resultsDir}.zip`,
          message: `所有实验数据已保存到 ${resultsDir}.zip`
        };
      } catch (error) {
        console.error('导出数据失败:', error);
        return {
          success: false,
          message: '导出数据失败：' + error.message
        };
      }
    }
  }
  
// 导出 StorageManager 类
export default StorageManager;
  