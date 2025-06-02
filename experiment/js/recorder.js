// 导入依赖
import StorageManager from './storage.js';

class VideoRecorder {
    constructor(storage = null) {
        // 如果外部传入storage对象，使用传入的
        // 否则创建一个新的实例
        this.storage = storage || new StorageManager();
        
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.isRecording = false;
        this.startTime = 0;
        this.previewElement = null;
    }
    
    // 初始化摄像头
    async initCamera(previewElement) {
      try {
        // 如果已经有流，先清理
        this.cleanup();
        
        console.log('正在获取摄像头权限...');
        
        if (!previewElement) {
          console.error('预览元素未提供');
          throw new Error('录像预览元素不存在');
        }
        
        // 获取新的媒体流
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            facingMode: 'user' // 使用前置摄像头
          },
          audio: true
        });
        
        console.log('摄像头访问成功，设置预览');
        
        // 显示摄像头预览
        this.previewElement = previewElement;
        previewElement.srcObject = this.stream;
        previewElement.style.transform = 'scaleX(-1)'; // 镜像显示
        
        // 确保预览可以播放
        previewElement.onloadedmetadata = () => {
          console.log('预览元数据加载完成，尝试播放');
          previewElement.play().catch(e => console.error('预览播放失败:', e));
        };
        
        // 尝试立即播放
        try {
          await previewElement.play();
          console.log('预览播放成功');
        } catch (e) {
          console.warn('预览自动播放失败，等待用户交互:', e);
        }
        
        return true;
      } catch (error) {
        console.error('摄像头访问失败:', error);
        this.cleanup();
        throw new Error('无法访问摄像头，请确保已授予权限并且摄像头可用。');
      }
    }
    
    // 开始录制
    async startRecording() {
      try {
        if (this.isRecording) {
          throw new Error('已经在录制中');
        }
        
        // 如果没有流，获取新的流
        if (!this.stream) {
          await this.initCamera(this.previewElement);
        }
        
        // 创建 MediaRecorder
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 2500000 // 2.5 Mbps
        });
        
        // 重置录制状态
        this.recordedChunks = [];
        this.startTime = Date.now();
        
        // 设置数据可用事件处理
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };
        
        // 开始录制
        this.mediaRecorder.start(1000); // 每秒保存一次数据
        this.isRecording = true;
        
        console.log('开始录制');
      } catch (error) {
        console.error('开始录制失败:', error);
        this.cleanup();
        throw new Error('开始录制失败: ' + error.message);
      }
    }
    
    // 停止录制
    async stopRecording() {
      try {
        if (!this.isRecording) {
          throw new Error('没有正在进行的录制');
        }
        
        return new Promise((resolve, reject) => {
          this.mediaRecorder.onstop = () => {
            const recordingDuration = Date.now() - this.startTime;
            console.log(`录制结束，时长: ${recordingDuration}ms`);
            
            const blob = new Blob(this.recordedChunks, {
              type: 'video/webm'
            });
            
            this.cleanup();
            resolve(blob);
          };
          
          this.mediaRecorder.onerror = (error) => {
            console.error('录制过程出错:', error);
            this.cleanup();
            reject(new Error('停止录制失败: ' + error.message));
          };
          
          this.mediaRecorder.stop();
          this.isRecording = false;
        });
      } catch (error) {
        console.error('停止录制失败:', error);
        this.cleanup();
        throw new Error('停止录制失败: ' + error.message);
      }
    }
    
    // 保存视频到指定路径
    async saveVideoToPath(videoBlob, participantId, videoId) {
      try {
        console.log('保存视频:', {
          participantId,
          videoId,
          blobSize: videoBlob.size,
          blobType: videoBlob.type
        });
        
        if (!videoBlob || videoBlob.size === 0) {
          throw new Error('视频数据无效');
        }
        
        // 获取当前视频的原始名称（如 M101）
        let originalVideoName = '';
        const currentVideo = window.experimentApp?.experiment?.getCurrentVideo();
        if (currentVideo && currentVideo.originalName) {
          originalVideoName = currentVideo.originalName;
        } else {
          // 回退方案：尝试从ID中提取
          if (videoId.startsWith('trial_')) {
            const num = parseInt(videoId.replace('trial_', '')) + 100;
            originalVideoName = `M${num}`;
          } else if (videoId.startsWith('practice_')) {
            const num = parseInt(videoId.replace('practice_', '')) + 100;
            originalVideoName = `P${num}`;
          } else {
            // 最后回退：使用原始ID
            originalVideoName = videoId;
          }
        }
        
        // 创建符合要求的文件名：被试编号_视频原始名称.webm
        const fileName = `${participantId}_${originalVideoName}.webm`;
        const filePath = `results/${participantId}_results/${participantId}_video/${fileName}`;
        
        console.log(`保存视频文件: ${fileName}`);
        
        // 保存到IndexedDB (不触发下载)
        await this.storage.saveFile(filePath, videoBlob);
        
        // 缓存视频到内存
        if (!window.recordedVideos) {
          window.recordedVideos = [];
        }
        window.recordedVideos.push({
          path: filePath,
          blob: videoBlob,
          fileName: fileName
        });
        
        console.log(`视频已保存: ${filePath}`);
        return filePath;
      } catch (error) {
        console.error('保存视频失败:', error);
        throw new Error('保存视频失败：' + error.message);
      }
    }
    
    // 添加辅助方法
    async _saveToIndexedDB(path, content) {
      if (!this.storage.db) {
        console.warn('数据库未初始化，无法保存');
        return;
      }
      
      return new Promise((resolve, reject) => {
        const transaction = this.storage.db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        
        // 尝试分块存储以减少存储压力
        const record = {
          path: path,
          data: content,
          timestamp: new Date().toISOString()
        };
        
        const request = store.put(record);
        
        request.onsuccess = () => {
          console.log(`文件保存到IndexedDB成功: ${path}`);
          resolve(path);
        };
        
        request.onerror = (event) => {
          console.error('IndexedDB保存失败', event);
          reject(new Error('IndexedDB保存失败'));
        };
      });
    }
    
    // 清理资源
    cleanup() {
      if (this.mediaRecorder) {
        this.mediaRecorder = null;
      }
      
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      
      if (this.previewElement) {
        this.previewElement.srcObject = null;
      }
      
      this.recordedChunks = [];
      this.isRecording = false;
      this.startTime = 0;
    }
}

// 导出 VideoRecorder 类
export default VideoRecorder;
  