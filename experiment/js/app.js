// 导入依赖
import ConfigManager from './config.js';
import StorageManager from './storage.js';
import VideoRecorder from './recorder.js';
import ExperimentController from './experiment.js';
import '../css/style.css';

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
    
    // 初始化应用
    async initializeApp() {
      try {
        // 检查配置文件
        const configCheck = await this.config.checkRequiredFiles();
        if (!configCheck.valid) {
          throw new Error(`缺少必要的配置文件: ${configCheck.missingFiles.join(', ')}`);
        }
        
        // 加载配置文件
        const configLoaded = await this.config.loadAllConfigs();
        if (!configLoaded) {
          throw new Error('加载配置文件失败');
        }
        
        // 检查摄像头权限
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
        } catch (error) {
          console.warn('摄像头权限检查失败，将在录制时再次请求权限');
        }
        
        // 绑定事件处理器
        this.bindEventHandlers();
        
        // 显示被试编号
        this.updateParticipantId();
        
        // 显示欢迎文本
        this.showWelcomeText();
        
        // 显示欢迎界面
        this.showScreen('welcome');
        
        console.log('实验应用初始化成功');
      } catch (error) {
        console.error('应用初始化失败:', error);
        this.showError(error.message);
        throw error;
      }
    }
    
    // 显示欢迎文本
    showWelcomeText() {
      console.log('显示欢迎文本');
      const welcomeText = this.config.getText('welcome');
      const welcomeScreen = document.getElementById('welcome-screen');
      if (welcomeScreen) {
        const welcomeTextElement = welcomeScreen.querySelector('p');
        if (welcomeTextElement) {
          welcomeTextElement.textContent = welcomeText;
          console.log('欢迎文本已更新');
        } else {
          console.error('找不到欢迎文本元素');
        }
      } else {
        console.error('找不到欢迎界面');
      }
    }
    
    // 显示文字指导语
    showTextInstructions() {
      console.log('显示文字指导语，当前索引:', this.currentInstructionIndex);
      
      // 尝试获取指导语文本内容
      const instructionTexts = [
        this.config.getText('text_instruction_1') || '请仔细观看视频，理解实验要求。',
        this.config.getText('text_instruction_2') || '在视频播放结束后，您将看到录制按钮。',
        this.config.getText('text_instruction_3') || '请按照视频中的示范进行录制。'
      ];

      console.log('指导语内容:', instructionTexts);
      
      // 获取容器元素 - 使用正确的ID
      let container = document.getElementById('instruction-text-container');
      
      // 如果找不到，尝试使用另一个ID
      if (!container) {
        container = document.getElementById('text-instructions-content');
        if (!container) {
          console.error('找不到指导语容器，创建一个');
          // 创建容器
          container = document.createElement('div');
          container.id = 'instruction-text-container';
          
          // 找到文字指导语屏幕
          const screen = document.getElementById('text-instructions-screen');
          if (screen) {
            // 插入到按钮前面
            const button = screen.querySelector('button');
            if (button) {
              screen.insertBefore(container, button);
            } else {
              screen.appendChild(container);
            }
          }
        }
      }
      
      // 清空容器
      container.innerHTML = '';
      
      // 创建指导语面板
      const panel = document.createElement('div');
      panel.className = 'instruction-panel';
      
      // 显示当前索引对应的指导语
      const currentText = instructionTexts[this.currentInstructionIndex];
      if (currentText) {
        panel.innerHTML = `<p>${currentText}</p>`;
      } else {
        panel.innerHTML = '<p>加载指导语失败</p>';
        console.error('指导语内容为空，索引:', this.currentInstructionIndex);
      }
      
      container.appendChild(panel);
      
      // 更新按钮文本和事件处理
      const btnUnderstood = document.getElementById('instruction-understood-btn');
      if (btnUnderstood) {
        btnUnderstood.textContent = this.currentInstructionIndex < 2 ? '下一页' : '我已了解';
        
        // 移除所有现有事件监听器
        const newBtn = btnUnderstood.cloneNode(true);
        btnUnderstood.parentNode.replaceChild(newBtn, btnUnderstood);
        
        // 添加新的事件监听器
        newBtn.addEventListener('click', () => {
          console.log('点击了我已了解/下一页按钮');
          this.nextTextInstruction();
        });
        
        console.log('已更新按钮文本和事件:', newBtn.textContent);
      } else {
        console.error('找不到我已了解按钮');
      }
      
      console.log('文字指导语显示完成，当前索引:', this.currentInstructionIndex);
    }
    
    // 显示练习介绍文本
    showPracticeIntro() {
      const introText = this.config.getText('practiceIntro');
      const practiceIntroElement = document.getElementById('practice-intro-text');
      if (practiceIntroElement) {
        practiceIntroElement.innerHTML = introText;
      }
    }
    
    // 显示结束语
    showCompletionText() {
      const completionText = this.config.getText('completion');
      const participantId = this.storage.getParticipantId();
      
      const completionScreen = document.getElementById('completion-screen');
      if (!completionScreen) return;
      
      completionScreen.innerHTML = `
        <div class="completion-container">
          <h2>实验完成</h2>
          <p>${completionText}</p>
          <div class="info-panel">
            <p><strong>被试编号:</strong> <span id="final-participant-id">${participantId}</span></p>
            <p>所有实验数据已自动导出为zip文件。</p>
            <p><strong>数据包含:</strong></p>
            <ul>
              <li>被试基本信息 (${participantId}_info.json)</li>
              <li>实验记录数据 (${participantId}_exp.csv)</li>
              <li>录制的视频文件 (${participantId}_video/)</li>
            </ul>
          </div>
          <div class="button-container">
            <button id="export-btn" class="primary-button">导出结果</button>
          </div>
        </div>
      `;
      
      // 重新绑定导出按钮事件
      const exportBtn = document.getElementById('export-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportData());
      }
    }
    
    // 下一个文字指导语
    nextTextInstruction() {
      console.log('执行nextTextInstruction，当前索引:', this.currentInstructionIndex);
      
      if (this.currentInstructionIndex < 2) {
        this.currentInstructionIndex++;
        console.log('切换到下一个指导语，新索引:', this.currentInstructionIndex);
        this.showTextInstructions();
      } else {
        console.log('所有指导语已显示完，准备开始练习');
        // 先保存索引0以备重新显示
        this.currentInstructionIndex = 0;
        this.showScreen('practice');
        this.showPracticeIntro();
        this.startPractice();
      }
    }
    
    // 上一个文字指导语
    prevTextInstruction() {
      console.log('尝试切换到上一个指导语，当前索引:', this.currentInstructionIndex);
      
      if (this.currentInstructionIndex > 0) {
        this.currentInstructionIndex--;
        console.log('切换到上一个指导语，新索引:', this.currentInstructionIndex);
        this.showTextInstructions();
      }
    }
    
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
        
        // 下载zip文件
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
    
    showSuccess(message) {
      // 移除现有的成功提示
      const existingSuccess = document.querySelector('.success-message');
      if (existingSuccess) {
        existingSuccess.remove();
      }
      
      const successElement = document.createElement('div');
      successElement.className = 'success-message';
      successElement.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 4px;
        z-index: 9999;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        max-width: 80%;
      `;
      successElement.textContent = message;
      
      document.body.appendChild(successElement);
      
      // 5秒后自动消失
      setTimeout(() => {
        if (successElement.parentNode) {
          successElement.remove();
        }
      }, 5000);
    }
    
    // 检查必要的DOM元素
    checkRequiredElements() {
      const requiredElements = [
        'welcome-screen',
        'info-screen',
        'video-instructions-screen',
        'text-instructions-screen',
        'practice-screen',
        'practice-decision-screen',
        'experiment-preparation-screen',
        'experiment-screen',
        'interval-screen',
        'completion-screen'
      ];
      
      for (const id of requiredElements) {
        const element = document.getElementById(id);
        if (!element) {
          console.error(`缺少必要的DOM元素: ${id}，尝试创建...`);
          // 创建缺失的屏幕
          const newScreen = document.createElement('div');
          newScreen.id = id;
          newScreen.className = 'screen';
          newScreen.style.display = 'none';
          
          // 根据屏幕类型添加必要的子元素
          switch(id) {
            case 'text-instructions-screen':
              newScreen.innerHTML = `
                <h2>实验指导语</h2>
                <div id="instruction-text-container"></div>
                <button id="instruction-understood-btn">下一页</button>
              `;
              break;
            case 'interval-screen':
              newScreen.innerHTML = `
                <div class="interval-content">
                  <p>请做好准备</p>
                  <div id="interval-countdown">2</div>
                </div>
              `;
              break;
            // 其他屏幕的默认内容...
          }
          
          document.body.appendChild(newScreen);
          console.log(`已创建缺失的屏幕: ${id}`);
        }
      }
      
      // 检查并创建其他必要的元素
      const additionalElements = [
        { id: 'instruction-text-container', parent: 'text-instructions-screen', className: 'instruction-container' },
        { id: 'interval-countdown', parent: 'interval-screen', className: 'countdown' }
      ];
      
      for (const { id, parent, className } of additionalElements) {
        const element = document.getElementById(id);
        if (!element) {
          const parentElement = document.getElementById(parent);
          if (parentElement) {
            const newElement = document.createElement('div');
            newElement.id = id;
            newElement.className = className;
            parentElement.appendChild(newElement);
            console.log(`已创建缺失的元素: ${id}`);
          }
        }
      }
    }
    
    // 绑定事件处理器
    bindEventHandlers() {
      console.log('开始绑定事件处理器...');
      
      // 欢迎界面
      const startBtn = document.getElementById('start-btn');
      if (startBtn) {
        startBtn.addEventListener('click', () => this.showScreen('info'));
        console.log('已绑定开始按钮事件');
      }
      
      // 信息收集界面
      const participantForm = document.getElementById('participant-form');
      if (participantForm) {
        participantForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveParticipantInfo();
        });
        console.log('已绑定表单提交事件');
      }
      
      // 视频指导语界面
      const prevInstructionBtn = document.getElementById('prev-instruction-btn');
      const nextInstructionBtn = document.getElementById('next-instruction-btn');
      if (prevInstructionBtn) {
        prevInstructionBtn.addEventListener('click', () => this.prevInstruction());
        console.log('已绑定上一个指导语按钮事件');
      }
      if (nextInstructionBtn) {
        nextInstructionBtn.addEventListener('click', () => this.nextInstruction());
        console.log('已绑定下一个指导语按钮事件');
      }
      
      // 文字指导语界面
      const prevTextBtn = document.getElementById('prev-text-btn');
      const nextTextBtn = document.getElementById('next-text-btn');
      if (prevTextBtn) {
        prevTextBtn.addEventListener('click', () => {
          console.log('点击上一页按钮');
          this.prevTextInstruction();
        });
        console.log('已绑定上一个文字指导语按钮事件');
      }
      if (nextTextBtn) {
        nextTextBtn.addEventListener('click', () => {
          console.log('点击下一页/我已知晓按钮');
          this.nextTextInstruction();
        });
        console.log('已绑定下一个文字指导语按钮事件');
      }
      
      // 练习界面
      const practiceRecordBtn = document.getElementById('practice-record-btn');
      const practiceStopBtn = document.getElementById('practice-stop-recording-btn');
      const practiceSkipBtn = document.getElementById('practice-skip-btn');
      
      if (practiceRecordBtn) {
        practiceRecordBtn.addEventListener('click', () => this.startPracticeRecording());
        console.log('已绑定练习录制按钮事件');
      }
      if (practiceStopBtn) {
        practiceStopBtn.addEventListener('click', () => this.stopPracticeRecording());
        console.log('已绑定练习停止按钮事件');
      }
      if (practiceSkipBtn) {
        practiceSkipBtn.addEventListener('click', () => this.skipPracticeVideo());
        console.log('已绑定练习跳过按钮事件');
      }
      
      // 练习决定界面
      const continuePracticeBtn = document.getElementById('continue-practice-btn');
      const startExperimentBtn = document.getElementById('start-experiment-btn');
      
      if (continuePracticeBtn) {
        continuePracticeBtn.addEventListener('click', () => this.continuePractice());
        console.log('已绑定继续练习按钮事件');
      }
      if (startExperimentBtn) {
        startExperimentBtn.addEventListener('click', () => this.startExperiment());
        console.log('已绑定开始实验按钮事件');
      }
      
      // 实验界面
      const experimentRecordBtn = document.getElementById('experiment-record-btn');
      const experimentStopBtn = document.getElementById('experiment-stop-recording-btn');
      const experimentSkipBtn = document.getElementById('experiment-skip-btn');
      
      if (experimentRecordBtn) {
        experimentRecordBtn.addEventListener('click', () => this.startExperimentRecording());
        console.log('已绑定实验录制按钮事件');
      }
      if (experimentStopBtn) {
        experimentStopBtn.addEventListener('click', () => this.stopExperimentRecording());
        console.log('已绑定实验停止按钮事件');
      }
      if (experimentSkipBtn) {
        experimentSkipBtn.addEventListener('click', () => this.skipExperimentVideo());
        console.log('已绑定实验跳过按钮事件');
      }
      
      // 结束界面
      const exportBtn = document.getElementById('export-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportData());
        console.log('已绑定导出按钮事件');
      }
      
      console.log('事件处理器绑定完成');
    }
    
    // 显示指定界面
    showScreen(screenId) {
      console.log('显示界面:', screenId);
      
      // 隐藏所有界面
      document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
      });
      
      // 显示指定界面
      const screen = document.getElementById(`${screenId}-screen`);
      if (screen) {
        screen.style.display = 'block';
        this.currentScreen = screenId;
        console.log('界面显示成功:', screenId);
      } else {
        console.error('找不到界面:', screenId);
      }
    }
    
    // 更新被试编号显示
    updateParticipantId() {
      const participantId = this.storage.getParticipantId();
      const participantIdElement = document.getElementById('participant-id');
      const finalParticipantIdElement = document.getElementById('final-participant-id');
      
      if (participantIdElement) {
        participantIdElement.textContent = participantId;
      }
      if (finalParticipantIdElement) {
        finalParticipantIdElement.textContent = participantId;      }
    }
    
    // 保存被试信息
    saveParticipantInfo() {
      const info = {
        name: document.getElementById('name').value,
        gender: document.getElementById('gender').value,
        age: parseInt(document.getElementById('age').value),
        deafParentsCount: parseInt(document.getElementById('deaf-parents').value),
        residenceCity: document.getElementById('residence').value
      };
      
      this.storage.saveParticipantInfo(info);
      this.showScreen('video-instructions');
      this.loadInstructionVideo();
    }
    
    // 加载视频通用方法
    async loadVideo(videoElement, videoPath, showControls = false) {
      return new Promise((resolve, reject) => {
        if (!videoElement) {
          reject(new Error('视频元素不存在'));
          return;
        }

        // 清除之前的事件监听器
        if (this.videoLoadedHandler) {
          videoElement.removeEventListener('loadeddata', this.videoLoadedHandler);
        }

        // 重置视频元素
        videoElement.pause();
        videoElement.currentTime = 0;
        videoElement.src = videoPath;
        videoElement.style.display = 'block';

        // 根据视频类型设置控制条
        if (showControls) {
          videoElement.setAttribute('controls', '');
        } else {
          videoElement.removeAttribute('controls');
        }

        // 保存事件处理器引用
        this.videoLoadedHandler = async () => {
          console.log('视频加载成功');
          try {
            await videoElement.play();
            console.log('视频开始播放');
            resolve();
          } catch (error) {
            console.error('视频播放失败:', error);
            reject(new Error('视频播放失败'));
          }
        };

        // 绑定事件
        videoElement.addEventListener('loadeddata', this.videoLoadedHandler);

        videoElement.onerror = (error) => {
          console.error('视频加载失败:', error);
          reject(new Error('视频加载失败'));
        };

        // 加载视频
        videoElement.load();
      });
    }
    
    // 设置视频结束事件处理
    setupVideoEndedHandler(videoElement, handlerType) {
      // 清除之前的事件监听器
      if (this.currentVideoEndedHandler) {
        videoElement.removeEventListener('ended', this.currentVideoEndedHandler);
      }
      
      let handler;
      switch(handlerType) {
        case 'practice':
          handler = () => {
            console.log('练习视频播放结束');
            videoElement.style.display = 'none';
            document.getElementById('practice-response-container').style.display = 'block';
          };
          break;
        case 'experiment':
          handler = () => {
            console.log('实验视频播放结束');
            videoElement.style.display = 'none';
            document.getElementById('experiment-response-container').style.display = 'block';
          };
          break;
        default:
          handler = () => console.log('视频播放结束');
      }
      
      this.currentVideoEndedHandler = handler;
      videoElement.addEventListener('ended', handler);
    }
    
    // 加载指导语视频
    async loadInstructionVideo() {
      try {
        const currentVideo = this.experiment.getCurrentVideo();
        if (!currentVideo || currentVideo.type !== 'instruction') {
          // 如果没有更多指导语视频，切换到文字指导语界面
          this.showScreen('text-instructions');
          this.showTextInstructions();
          return;
        }

        const videoElement = document.getElementById('instruction-video');
        if (!videoElement) {
          throw new Error('找不到指导语视频元素');
        }

        await this.loadVideo(videoElement, currentVideo.path, true); // 显示控制条
        
        // 更新进度显示
        const progress = this.experiment.getCurrentProgress();
        const currentInstructionElement = document.getElementById('current-instruction');
        if (currentInstructionElement) {
          currentInstructionElement.textContent = progress.current;
        }
        
        // 显示/隐藏导航按钮
        const prevBtn = document.getElementById('prev-instruction-btn');
        const nextBtn = document.getElementById('next-instruction-btn');
        
        if (prevBtn) {
          prevBtn.style.display = progress.current > 1 ? 'block' : 'none';
        }
        if (nextBtn) {
          nextBtn.style.display = 'block';
        }
      } catch (error) {
        console.error('加载指导语视频失败:', error);
        this.showError('加载指导语视频失败：' + error.message);
      }
    }
    
    // 上一个指导语
    async prevInstruction() {
      const prevIndex = this.experiment.currentTrialIndex - 1;
      if (prevIndex >= 0) {
        this.experiment.currentTrialIndex = prevIndex;
        await this.loadInstructionVideo();
      }
    }
    
    // 下一个指导语
    async nextInstruction() {
      const nextVideo = this.experiment.getNextVideo();
      if (!nextVideo || nextVideo.type !== 'instruction') {
        // 所有指导语视频播放完毕，切换到文字指导语界面
        this.showScreen('text-instructions');
        this.showTextInstructions();
        return;
      }
      
      // 隐藏继续按钮
      const nextBtn = document.getElementById('next-instruction-btn');
      if (nextBtn) {
        nextBtn.style.display = 'none';
      }
      
      // 加载下一个指导语视频
      await this.loadInstructionVideo();
    }
    
    // 开始练习
    startPractice() {
      // 重置练习视频索引
      this.experiment.currentTrialIndex = this.experiment.videoSequence.findIndex(v => v.type === 'practice');
      this.isPractice = true;
      this.showScreen('practice');
      this.loadPracticeVideo();
    }
    
    // 加载练习视频
    async loadPracticeVideo() {
      try {
        const currentVideo = this.experiment.getCurrentVideo();
        if (!currentVideo || currentVideo.type !== 'practice') {
          console.log('练习视频播放完毕，显示练习结束界面');
          this.showScreen('practice-decision');
          return;
        }

        const videoElement = document.getElementById('practice-video');
        if (!videoElement) {
          throw new Error('找不到练习视频元素');
        }

        // 隐藏录制容器和响应容器
        const recordingContainer = document.getElementById('practice-recording-container');
        const responseContainer = document.getElementById('practice-response-container');
        
        if (recordingContainer) {
          recordingContainer.style.display = 'none';
        }
        if (responseContainer) {
          responseContainer.style.display = 'none';
        }
        
        // 加载视频
        await this.loadVideo(videoElement, currentVideo.path, false);
        
        // 设置视频结束事件
        this.setupVideoEndedHandler(videoElement, 'practice');
        
        // 更新进度显示
        const progress = this.experiment.getCurrentProgress();
        const currentPracticeElement = document.getElementById('current-practice');
        if (currentPracticeElement) {
          currentPracticeElement.textContent = progress.current;
        }

        console.log('练习视频加载成功');
      } catch (error) {
        console.error('加载练习视频失败:', error);
        this.showError('加载练习视频失败：' + error.message);
      }
    }
    
    // 开始练习录制
    async startPracticeRecording() {
      try {
        console.log('开始练习录制');
        this.isRecording = true;
        
        // 隐藏响应按钮
        const responseContainer = document.getElementById('practice-response-container');
        if (responseContainer) {
          responseContainer.style.display = 'none';
        }
        
        // 显示录制容器
        const recordingContainer = document.getElementById('practice-recording-container');
        if (!recordingContainer) {
          throw new Error('找不到录制容器');
        }
        recordingContainer.style.display = 'block';
        
        // 获取或创建预览元素
        let previewElement = document.getElementById('practice-video-preview');
        if (!previewElement) {
          // 如果预览元素不存在，创建一个
          previewElement = document.createElement('video');
          previewElement.id = 'practice-video-preview';
          previewElement.autoplay = true;
          previewElement.muted = true;
          previewElement.playsInline = true;
          previewElement.style.cssText = `
            width: 100%;
            height: auto;
            max-height: 70vh;
            border: 2px solid #ccc;
            border-radius: 8px;
            display: block;
          `;
          recordingContainer.insertBefore(previewElement, recordingContainer.firstChild);
          console.log('创建新的预览元素');
        }
        
        console.log('初始化摄像头');
        // 初始化摄像头
        await this.recorder.initCamera(previewElement);
        
        // 开始录制
        await this.recorder.startRecording();
      } catch (error) {
        console.error('开始录制失败:', error);
        this.showError('开始录制失败：' + error.message);
        this.isRecording = false;
      }
    }
    
    // 停止练习录制
    async stopPracticeRecording() {
      try {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        const recordingContainer = document.getElementById('practice-recording-container');
        if (recordingContainer) {
          recordingContainer.style.display = 'none';
        }
        
        const currentVideo = this.experiment.getCurrentVideo();
        if (!currentVideo) {
          throw new Error('没有找到当前视频');
        }
        
        const videoBlob = await this.recorder.stopRecording();
        const videoPath = await this.recorder.saveVideoToPath(videoBlob, this.storage.getParticipantId(), currentVideo.id);
        
        this.experiment.recordTrialResult(currentVideo.id, false, videoPath);
        
        const nextVideo = this.experiment.getNextVideo();
        if (!nextVideo || nextVideo.type !== 'practice') {
          this.showScreen('practice-decision');
          return;
        }
        
        this.showIntervalScreen();
      } catch (error) {
        console.error('停止录制失败:', error);
        this.showError('停止录制失败：' + error.message);
      }
    }
    
    // 跳过练习视频
    skipPracticeVideo() {
      const currentVideo = this.experiment.getCurrentVideo();
      if (!currentVideo) return;
      
      // 使用experiment控制器处理跳过逻辑
      this.experiment.handleSkippedVideo(currentVideo.id);
      
      // 获取下一个视频
      const nextVideo = this.experiment.getNextVideo();
      if (!nextVideo || nextVideo.type !== 'practice') {
        this.showScreen('practice-decision');
        return;
      }
      
      this.showIntervalScreen();
    }
    
    // 显示间隔屏幕 - 白色卡片式设计，位于页面中上方
    showIntervalScreen() {
      this.showScreen('interval');
      
      const intervalScreen = document.getElementById('interval-screen');
      if (!intervalScreen) {
        console.error('找不到间隔屏幕');
        setTimeout(() => this.proceedAfterInterval(), 2000);
        return;
      }
      
      // 完全覆盖现有样式，使其与实验准备屏幕风格一致
      intervalScreen.style.cssText = `
        position: static;
        background-color: white;
        width: 90%;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 20px;
        display: block;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        text-align: center;
        top: auto;
        left: auto;
      `;
      
      // 设置内容
      intervalScreen.innerHTML = `
        <h2 style="
          font-size: 24px;
          margin-bottom: 30px;
          color: #333;
          text-align: center;
        ">请做好准备</h2>
      `;
      
      // 2秒后继续
      setTimeout(() => this.proceedAfterInterval(), 2000);
    }
    
    // 间隔结束后继续
    proceedAfterInterval() {
      if (this.isPractice) {
        this.showScreen('practice');
        this.loadPracticeVideo();
      } else {
        this.showScreen('experiment');
        this.loadExperimentVideo();
      }
    }
    
    // 继续练习
    continuePractice() {
      this.experiment.currentTrialIndex = this.experiment.videoSequence.findIndex(v => v.type === 'practice');
      this.isPractice = true;
      this.showScreen('practice');
      this.loadPracticeVideo();
    }
    
    // 开始实验
    startExperiment() {
      // 重置实验视频索引
      this.experiment.currentTrialIndex = this.experiment.videoSequence.findIndex(v => v.type === 'experiment');
      this.isPractice = false;
      this.showScreen('experiment-preparation');
      this.startCountdown();
    }
    
    // 开始倒计时
    startCountdown() {
      try {
        const countdownElement = document.getElementById('countdown');
        if (!countdownElement) {
          throw new Error('找不到倒计时元素');
        }

        let count = 3;
        countdownElement.textContent = count;
        
        const timer = setInterval(() => {
          count--;
          countdownElement.textContent = count;
          
          if (count < 0) {
            clearInterval(timer);
            this.showScreen('experiment');
            this.loadExperimentVideo().catch(error => {
              console.error('加载实验视频失败:', error);
              this.showError('加载实验视频失败：' + error.message);
            });
          }
        }, 1000);

        // 保存timer引用以便清理
        this.countdownTimer = timer;
      } catch (error) {
        console.error('开始倒计时失败:', error);
        this.showError('开始倒计时失败：' + error.message);
      }
    }
    
    // 加载实验视频
    async loadExperimentVideo() {
      try {
        const currentVideo = this.experiment.getCurrentVideo();
        if (!currentVideo || currentVideo.type !== 'experiment') {
          console.log('实验视频播放完毕，显示完成界面');
          this.showScreen('completion');
          this.showCompletionText();
          return;
        }

        const videoElement = document.getElementById('experiment-video');
        if (!videoElement) {
          throw new Error('找不到实验视频元素');
        }

        // 记录视频开始时间
        this.experiment.setVideoStartTime();

        // 隐藏录制容器和响应容器
        const recordingContainer = document.getElementById('experiment-recording-container');
        const responseContainer = document.getElementById('experiment-response-container');
        
        if (recordingContainer) {
          recordingContainer.style.display = 'none';
        }
        if (responseContainer) {
          responseContainer.style.display = 'none';
        }
        
        // 确保视频元素可见
        videoElement.style.display = 'block';

        // 加载视频
        await this.loadVideo(videoElement, currentVideo.path, false);
        
        // 设置视频结束事件
        this.setupVideoEndedHandler(videoElement, 'experiment');
        
        // 更新进度显示 - 只显示当前编号，不显示总数
        const progress = this.experiment.getCurrentProgress();
        const progressElement = document.getElementById('experiment-progress');
        if (progressElement) {
          progressElement.innerHTML = `<span id="current-trial">${progress.current}</span>`;
        }

        console.log('实验视频加载成功');
      } catch (error) {
        console.error('加载实验视频失败:', error);
        this.showError('加载实验视频失败：' + error.message);
      }
    }
    
    // 开始实验录制
    async startExperimentRecording() {
      try {
        console.log('开始实验录制');
        this.isRecording = true;
        
        // 隐藏响应按钮
        const responseContainer = document.getElementById('experiment-response-container');
        if (responseContainer) {
          responseContainer.style.display = 'none';
        }
        
        // 显示录制容器
        const recordingContainer = document.getElementById('experiment-recording-container');
        if (!recordingContainer) {
          throw new Error('找不到录制容器');
        }
        recordingContainer.style.display = 'block';
        
        // 获取或创建预览元素
        let previewElement = document.getElementById('experiment-video-preview');
        if (!previewElement) {
          // 如果预览元素不存在，创建一个
          previewElement = document.createElement('video');
          previewElement.id = 'experiment-video-preview';
          previewElement.autoplay = true;
          previewElement.muted = true;
          previewElement.playsInline = true;
          previewElement.style.cssText = `
            width: 100%;
            height: auto;
            max-height: 70vh;
            border: 2px solid #ccc;
            border-radius: 8px;
            display: block;
          `;
          recordingContainer.insertBefore(previewElement, recordingContainer.firstChild);
          console.log('创建新的预览元素');
        }
        
        console.log('初始化摄像头');
        // 初始化摄像头
        await this.recorder.initCamera(previewElement);
        
        // 开始录制
        await this.recorder.startRecording();
      } catch (error) {
        console.error('开始录制失败:', error);
        this.showError('开始录制失败：' + error.message);
        this.isRecording = false;
      }
    }
    
    // 停止实验录制
    async stopExperimentRecording() {
      if (!this.isRecording) return;
      
      try {
        this.isRecording = false;
        
        // 隐藏录制容器
        const recordingContainer = document.getElementById('experiment-recording-container');
        if (recordingContainer) {
          recordingContainer.style.display = 'none';
        }
        
        // 获取当前视频
        const currentVideo = this.experiment.getCurrentVideo();
        if (!currentVideo) {
          throw new Error('没有找到当前视频');
        }
        
        console.log('停止录制，当前视频:', currentVideo);
        
        // 停止录制并获取视频数据
        const videoBlob = await this.recorder.stopRecording();
        if (!videoBlob || videoBlob.size === 0) {
          throw new Error('录制的视频数据无效');
        }
        
        // 保存视频文件
        const videoPath = await this.recorder.saveVideoToPath(
          videoBlob,
          this.storage.getParticipantId(),
          currentVideo.id
        );
        
        console.log('视频已保存到:', videoPath);
        
        // 记录试次结果
        this.experiment.recordTrialResult(currentVideo.id, false, videoPath);
        
        // 确保处于实验模式
        if (this.isPractice) {
          console.log('检测到处于练习模式，但应当为实验模式');
          this.isPractice = false;
        }
        
        // 获取下一个视频
        const nextVideo = this.experiment.getNextVideo();
        console.log('下一个视频:', nextVideo);
        
        // 处理实验结束
        if (!nextVideo || nextVideo.type !== 'experiment') {
          console.log('实验结束，显示完成界面');
          this.showScreen('completion');
          this.showCompletionText();
          
          // 延迟导出数据
          setTimeout(() => {
            console.log('开始自动导出数据...');
            this.exportData()
              .then(success => {
                if (success) {
                  console.log('数据自动导出成功');
                } else {
                  console.error('数据自动导出失败');
                  this.showError('数据自动导出失败，请点击"导出数据"按钮重试');
                }
              })
              .catch(error => {
                console.error('数据导出异常:', error);
                this.showError('数据自动导出出错：' + error.message);
              });
          }, 500);
          
          return;
        }
        
        // 显示间隔屏幕
        this.showIntervalScreen();
      } catch (error) {
        console.error('停止录制失败:', error);
        this.showError('停止录制失败：' + error.message);
      }
    }
    
    // 跳过实验视频
    skipExperimentVideo() {
      const currentVideo = this.experiment.getCurrentVideo();
      if (!currentVideo) return;
      
      // 处理跳过逻辑
      this.experiment.handleSkippedVideo(currentVideo.id);
      
      const nextVideo = this.experiment.getNextVideo();
      if (!nextVideo || nextVideo.type !== 'experiment') {
        this.showScreen('completion');
        this.showCompletionText();
        return;
      }
      
      this.showIntervalScreen();
    }
    
    // 将结果转换为CSV格式
    convertResultsToCSV(results) {
      if (!results || results.length === 0) {
        console.error('没有可导出的数据');
        return 'No data to export';
      }
      
      console.log('准备转换数据为CSV，数据条目:', results.length);
      
      const headers = [
        'trial_id',
        'is_skipped',
        'is_repeated_trial',
        'trial_start_timestamp',
        'trial_end_timestamp',
        'recording_duration_s',
        'recording_filepath',
        'sequence'
      ];
      
      const rows = results.map(result => {
        // 明确打印每行以确保数据正确
        console.log('处理CSV行:', JSON.stringify(result));
        
        return [
          result.trial_id || '',
          result.is_skipped !== undefined ? result.is_skipped : '',
          result.is_repeated_trial !== undefined ? result.is_repeated_trial : '',
          result.trial_start_timestamp || '',
          result.trial_end_timestamp || '',
          result.recording_duration_s !== undefined ? result.recording_duration_s : '',
          result.recording_filepath || 'N/A',
          result.sequence !== undefined ? result.sequence : ''
        ];
      });
      
      // 将二维数组转换为CSV字符串
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    // 显示加载状态
    showLoading(message) {
      this.isLoading = true;
      this.loadingMessage = message;
      
      // 创建或更新加载提示
      let loadingElement = document.getElementById('loading-overlay');
      if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'loading-overlay';
        loadingElement.innerHTML = `
          <div class="loading-content">
            <div class="spinner"></div>
            <p id="loading-message"></p>
          </div>
        `;
        document.body.appendChild(loadingElement);
      }
      
      const loadingMessageElement = document.getElementById('loading-message');
      if (loadingMessageElement) {
        loadingMessageElement.textContent = message;
      }
      loadingElement.style.display = 'flex';
    }
    
    // 隐藏加载状态
    hideLoading() {
      this.isLoading = false;
      this.loadingMessage = '';
      
      const loadingElement = document.getElementById('loading-overlay');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
    }
    
    // 显示错误提示
    showError(message) {
      console.error(message);
      
      // 移除现有的错误提示
      const existingError = document.querySelector('.error-message');
      if (existingError) {
        existingError.remove();
      }
      
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      errorElement.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #ff4444;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 9999;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;
      errorElement.textContent = message;
      
      document.body.appendChild(errorElement);
      
      // 3秒后自动消失
      setTimeout(() => {
        if (errorElement.parentNode) {
          errorElement.remove();
        }
      }, 3000);
    }

    // 初始化视频元素
    initializeVideoElements() {
      // 设置视频元素属性
      const videoSelectors = [
        '#instruction-video',
        '#practice-video',
        '#experiment-video'
      ];

      videoSelectors.forEach(selector => {
        const video = document.querySelector(selector);
        if (video) {
          // 移除控制条（除了指导语视频）
          if (selector !== '#instruction-video') {
            video.removeAttribute('controls');
          }
          // 设置自动播放
          video.setAttribute('autoplay', '');
          // 设置静音
          video.setAttribute('muted', '');
          // 设置playsInline属性
          video.setAttribute('playsInline', '');
        }
      });
    }

    // 显示录制界面
    showRecordingInterface(videoType) {
      const containerId = videoType === 'practice' 
        ? 'practice-recording-container' 
        : 'experiment-recording-container';
      
      const container = document.getElementById(containerId);
      if (container) {
        container.style.display = 'block';
      }
    }

    // 隐藏录制界面
    hideRecordingInterface(videoType) {
      const containerId = videoType === 'practice' 
        ? 'practice-recording-container' 
        : 'experiment-recording-container';
      
      const container = document.getElementById(containerId);
      if (container) {
        container.style.display = 'none';
      }
    }

    // 重置实验状态
    resetExperimentState() {
      this.currentScreen = 'welcome';
      this.isRecording = false;
      this.isPractice = true;
      this.currentInstructionIndex = 0;
      
      // 清理录制器
      if (this.recorder) {
        this.recorder.cleanup();
      }
      
      // 清理定时器
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
    }

    // 处理页面卸载事件
    handlePageUnload() {
      this.cleanup();
    }

    // 清理资源
    cleanup() {
      console.log('清理实验应用资源...');
      
      // 清理定时器
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      
      // 清理录制器
      if (this.recorder) {
        this.recorder.cleanup();
      }
      
      // 清理视频事件监听器
      if (this.currentVideoEndedHandler) {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          video.removeEventListener('ended', this.currentVideoEndedHandler);
        });
        this.currentVideoEndedHandler = null;
      }
      
      if (this.videoLoadedHandler) {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          video.removeEventListener('loadeddata', this.videoLoadedHandler);
        });
        this.videoLoadedHandler = null;
      }
      
      console.log('资源清理完成');
    }
  }
  
// 导出 ExperimentApp 类
export default ExperimentApp;

// 在页面加载完成后初始化实验
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
