// 导入依赖
import StorageManager from './storage.js';

// 实验控制器
class ExperimentController {
    constructor(participantId) {
      this.participantId = participantId;
      this.storage = new StorageManager(participantId);
      this.currentTrialIndex = 0;
      this.skippedVideos = new Map();
      this.trialResults = [];
      
      // 添加实验开始时间记录
      this.startTime = new Date().toISOString();
      console.log('记录实验开始时间:', this.startTime);
      
      // 初始化视频序列
      this.initializeVideoSequence();
      
      // 添加视频处理计数器
      this.completedVideos = 0;
      this.totalMainVideos = 45; // 总共45个主实验视频
    }
    
    // 初始化视频序列 - 完全动态扫描
    async initializeVideoSequence() {
      try {
        console.log('初始化视频序列...');
        
        // 动态扫描指导语视频
        const instructionVideos = await this.scanInstructionVideos();
      
        // 动态扫描练习视频
        const practiceVideos = await this.scanPracticeVideos();
      
        // 动态扫描实验视频
        const experimentVideos = await this.scanExperimentVideos();
      
      // 合并所有视频序列
      this.videoSequence = [
        ...instructionVideos,
        ...practiceVideos,
        ...experimentVideos
      ];
      
      // 随机化练习视频顺序
      const practiceStartIndex = instructionVideos.length;
      const practiceEndIndex = practiceStartIndex + practiceVideos.length;
      const practiceSection = this.videoSequence.slice(practiceStartIndex, practiceEndIndex);
      const shuffledPractice = this.shuffleArray([...practiceSection]);
      this.videoSequence.splice(practiceStartIndex, practiceSection.length, ...shuffledPractice);
      
      // 随机化实验视频顺序
      const experimentStartIndex = practiceEndIndex;
      const experimentSection = this.videoSequence.slice(experimentStartIndex);
      const shuffledExperiment = this.shuffleArray([...experimentSection]);
      this.videoSequence.splice(experimentStartIndex, experimentSection.length, ...shuffledExperiment);
        
        // 更新视频总数
        this.totalInstructionVideos = instructionVideos.length;
        this.totalPracticeVideos = practiceVideos.length;
        this.totalMainVideos = experimentVideos.length;
        
        console.log('视频序列初始化完成:', {
          instructionCount: instructionVideos.length,
          practiceCount: practiceVideos.length,
          experimentCount: experimentVideos.length,
          totalCount: this.videoSequence.length
        });
        
        return true;
      } catch (error) {
        console.error('视频序列初始化失败:', error);
        return false;
      }
    }

    // 扫描指导语视频
    async scanInstructionVideos() {
      try {
        console.log('扫描指导语视频...');
        const instructionVideos = [];
        
        // 检查指导语文件夹中的视频
        for (let i = 1; i <= 30; i++) { // 检查最多30个可能的文件
          const paddedNum = String(i).padStart(2, '0');
          const path = `videos/instructions/${paddedNum}.mp4`;
          
          try {
            const response = await fetch(path, { method: 'HEAD', cache: 'no-store' });
            if (response.ok) {
              instructionVideos.push({
                id: `instruction_${i}`,
                type: 'instruction',
                path: path,
                originalName: `instruction_${i}`
              });
            }
          } catch (e) {
            // 忽略错误，继续检查
          }
        }
        
        console.log(`找到 ${instructionVideos.length} 个指导语视频`);
        return instructionVideos;
      } catch (error) {
        console.error('扫描指导语视频失败:', error);
        return [];
      }
    }

    // 扫描练习视频
    async scanPracticeVideos() {
      try {
        console.log('扫描练习视频...');
        const practiceVideos = [];
        
        // 检查练习文件夹中的视频
        for (let i = 101; i <= 103; i++) {
          const path = `videos/practice/P${i}.mp4`;
          
          try {
            const response = await fetch(path, { method: 'HEAD', cache: 'no-store' });
            if (response.ok) {
              practiceVideos.push({
                id: `practice_${i}`,
                type: 'practice',
                path: path,
                originalName: `P${i}`,
                trialId: i
              });
            }
          } catch (e) {
            // 忽略错误，继续检查
          }
        }
        
        console.log(`找到 ${practiceVideos.length} 个练习视频`);
        return practiceVideos;
      } catch (error) {
        console.error('扫描练习视频失败:', error);
        return [];
      }
    }

    // 扫描主实验视频文件
    async scanExperimentVideos() {
      try {
        console.log('正在扫描实验视频文件...');
        const experimentVideos = [];
        
        // 扫描方法1: 尝试使用fetch获取视频列表
        try {
          const response = await fetch('videos/main/?list');
          if (response.ok) {
            const fileList = await response.json();
            console.log('成功获取视频文件列表:', fileList);
            
            // 处理文件列表
            for (const fileName of fileList) {
              if (fileName.startsWith('M') && fileName.endsWith('.mp4')) {
                const num = parseInt(fileName.substring(1, fileName.length - 4));
                if (!isNaN(num)) {
                  experimentVideos.push({
                    id: `trial_${num - 100}`,
                    type: 'experiment',
                    path: `videos/main/${fileName}`,
                    originalName: fileName.replace('.mp4', ''),
                    trialId: num
                  });
                }
              }
            }
          }
        } catch (error) {
          console.log('无法通过API获取视频列表，将使用扫描方法');
        }
        
        // 如果方法1失败，尝试方法2: 使用预定义范围扫描视频
        if (experimentVideos.length === 0) {
          console.log('使用扫描方式检测实验视频...');
          
          // 扫描范围: 假设视频范围在101-150之间
          const potentialVideoNumbers = [];
          for (let i = 101; i <= 150; i++) {
            potentialVideoNumbers.push(i);
          }
          
          // 并行检测所有可能的视频文件
          const checkResults = await Promise.allSettled(
            potentialVideoNumbers.map(num => this.checkVideoExists(`videos/main/M${num}.mp4`, num))
          );
          
          // 过滤出存在的视频
          for (const result of checkResults) {
            if (result.status === 'fulfilled' && result.value) {
              experimentVideos.push(result.value);
            }
          }
          
          console.log(`扫描到 ${experimentVideos.length} 个实验视频文件`);
        }
        
        // 如果上述方法都失败，则使用旧的硬编码列表作为备份
        if (experimentVideos.length === 0) {
          console.warn('无法动态扫描视频，使用硬编码备份列表');
          return this.getBackupExperimentVideos();
        }
        
        return experimentVideos;
        
      } catch (error) {
        console.error('扫描实验视频失败:', error);
        // 出错时使用备用列表
        return this.getBackupExperimentVideos();
      }
    }

    // 检查单个视频是否存在
    async checkVideoExists(path, num) {
      try {
        const response = await fetch(path, { method: 'HEAD' });
        if (response.ok) {
          return {
            id: `trial_${num - 100}`,
            type: 'experiment',
            path: path,
            originalName: `M${num}`,
            trialId: num
          };
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    // 备用视频列表方法
    getBackupExperimentVideos() {
      const backupVideoNumbers = [
        101, 102, 103, 105, 106, 107, 108, 109, 110, 
        111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 
        121, 122, 123, 124, 126, 127, 128, 129, 130, 
        131, 132, 133, 134, 135, 136, 137, 138, 139, 
        141, 142, 143, 145, 146, 147, 148, 150
      ];
      
      return backupVideoNumbers.map(num => ({
        id: `trial_${num - 100}`,
        type: 'experiment',
        path: `videos/main/M${num}.mp4`,
        originalName: `M${num}`,
        trialId: num
      }));
    }
    
    // 记录视频开始播放时间
    setVideoStartTime() {
      this.videoStartTime = new Date().toISOString();
      console.log('记录视频开始时间:', this.videoStartTime);
    }
    
    // 记录试次结果 - 完全使用规范字段名
    recordTrialResult(videoId, skipped = false, videoPath = null, skipCount = 0) {
      const currentVideo = this.videoSequence[this.currentTrialIndex];
      if (!currentVideo) return null;
      
      // 视频原始名称（M101 等）
      const videoOriginalName = currentVideo.originalName || '';
      
      // 判断是否为重复试次
      const isRepeatedTrial = currentVideo.isRetry ? 1 : 0;
      
      // 确定跳过状态: 0=未跳过, 1=跳过1次, 2=永久跳过, 3=填充试次
      let isSkipped = 0;
      if (currentVideo.isFiller) {
        isSkipped = 3; // 填充试次
      } else if (skipped) {
        isSkipped = skipCount || 1; // 跳过状态
      }
      
      // 计算录制时长
      let recordingDurationS = 0;
      if (!skipped && this.videoStartTime) {
        const startMs = new Date(this.videoStartTime).getTime();
        const endMs = new Date().getTime();
        recordingDurationS = Math.round((endMs - startMs) / 1000);
      }
      
      // 生成结果对象，使用标准字段名
      const result = {
        trial_id: videoOriginalName,           // M101, P102 等
        is_skipped: isSkipped,                 // 0,1,2,3
        is_repeated_trial: isRepeatedTrial,    // 0,1
        trial_start_timestamp: this.videoStartTime || new Date().toISOString(),
        trial_end_timestamp: new Date().toISOString(),
        recording_duration_s: recordingDurationS,
        recording_filepath: skipped ? 'N/A' : videoPath,
        sequence: this.getCurrentSequenceNumber() // 播放顺序
      };
      
      this.trialResults.push(result);
      console.log('记录试次结果:', result);
      
      return result;
    }
    
    // 获取当前视频
    getCurrentVideo() {
      return this.videoSequence[this.currentTrialIndex];
    }
    
    // 获取下一个视频
    getNextVideo() {
      this.currentTrialIndex++;
      return this.getCurrentVideo();
    }
    
    // 获取当前进度 - 使用动态检测的视频数量
    getCurrentProgress() {
      const currentVideo = this.getCurrentVideo();
      if (!currentVideo) return { current: 0, total: 0 };
      
      let total;
      let current;
      
      switch(currentVideo.type) {
        case 'instruction':
          // 使用动态检测的指导语数量
          total = this.totalInstructionVideos || 0;
          
          // 计算当前是第几个指导语
          current = 1; // 默认为1
          for (let i = 0; i < this.currentTrialIndex; i++) {
            if (this.videoSequence[i] && this.videoSequence[i].type === 'instruction') {
              current++;
            }
          }
          break;
          
        case 'practice':
          // 使用动态检测的练习视频数量
          total = this.totalPracticeVideos || 3;
          
          // 计算当前是第几个练习视频
          current = 1; // 默认为1
          for (let i = 0; i < this.currentTrialIndex; i++) {
            if (this.videoSequence[i] && this.videoSequence[i].type === 'practice') {
              current++;
            }
          }
          break;
          
        case 'experiment':
          // 使用动态检测的实验视频数量
          total = this.totalMainVideos || 0;
          
          // 计算当前是第几个实验视频
          current = 1; // 默认为1
          for (let i = 0; i < this.currentTrialIndex; i++) {
            if (this.videoSequence[i] && this.videoSequence[i].type === 'experiment' && !this.videoSequence[i].isFiller) {
              current++;
            }
          }
          break;
          
        default:
          total = 0;
          current = 0;
      }
      
      return { current, total };
    }
    
    // 获取当前序列号
    getCurrentSequenceNumber() {
      return this.currentTrialIndex + 1;
    }
    
    // 获取所有试次结果
    getAllTrialResults() {
      return this.trialResults;
    }
    
    // 安排重试视频在队列中的位置
    arrangeRetryVideoPosition(videoToReinsert) {
      // 获取当前位置
      const currentPosition = this.currentTrialIndex;
      
      // 计算最小插入位置(至少3个试次之后)
      const minInsertPosition = currentPosition + 3;
      
      // 计算剩余试次数
      const remainingTrials = this.videoSequence.length - currentPosition;
      
      console.log(`当前位置: ${currentPosition}, 最小插入位置: ${minInsertPosition}, 剩余试次: ${remainingTrials}`);
      
      // 如果有足够的剩余试次，随机插入
      if (remainingTrials > 5) {
        // 在minInsertPosition和剩余试次的80%位置之间随机插入
        const randomOffset = Math.floor(Math.random() * Math.min(remainingTrials - 3, 20)) + 3;
        const insertPosition = currentPosition + randomOffset;
        
        console.log(`将跳过的视频 ${videoToReinsert.id} 随机插入到位置 ${insertPosition} (当前位置 + ${randomOffset})`);
        this.videoSequence.splice(insertPosition, 0, videoToReinsert);
      } else {
        // 如果剩余试次不多，放在接近末尾但不是最末尾的位置
        const insertPosition = this.videoSequence.length - 1;
        
        console.log(`将跳过的视频 ${videoToReinsert.id} 插入到倒数第二位置 ${insertPosition}`);
        this.videoSequence.splice(insertPosition, 0, videoToReinsert);
      }
    }

    // 处理跳过的视频
    handleSkippedVideo(videoId) {
      console.log(`处理跳过的视频: ${videoId}`);
      
      // 获取当前视频
      const currentVideo = this.getCurrentVideo();
      if (!currentVideo) return;
      
      // 获取基本视频ID（去除后缀）
      const baseVideoId = videoId.replace(/(_retry_\d+|_filler)/g, '');
      
      // 检查是否已经是重试视频
      const isRetry = videoId.includes('_retry_');
      console.log(`视频 ${baseVideoId} 是否为重试视频: ${isRetry}`);
      
      // 获取当前跳过计数
      const skipCount = this.skippedVideos.get(baseVideoId) || 0;
      const newSkipCount = skipCount + 1;
      this.skippedVideos.set(baseVideoId, newSkipCount);
      
      // 如果是练习视频，使用特殊逻辑
      if (currentVideo.type === 'practice') {
        // 如果是重试或者第二次跳过，不再安排重试
        if (isRetry || newSkipCount >= 2) {
          console.log(`练习视频 ${baseVideoId} 被永久跳过 (是重试:${isRetry} 或 第${newSkipCount}次跳过)`);
          this.recordTrialResult(videoId, true, null, 2); // 记录为永久跳过
          return;
        }
        
        // 第一次跳过，记录并安排重试
        console.log(`练习视频 ${baseVideoId} 第一次被跳过，安排重试`);
        this.recordTrialResult(videoId, true, null, 1); // 记录为跳过一次
        
        // 创建重试视频
        const videoToReinsert = {
          ...currentVideo,
          id: `${baseVideoId}_retry_1`,
          originalName: currentVideo.originalName,
          isRetry: true
        };
        
        // 找到剩余的练习视频，在最后一个练习视频之后立即插入
        let lastPracticeIndex = this.currentTrialIndex;
        for (let i = this.currentTrialIndex + 1; i < this.videoSequence.length; i++) {
          if (this.videoSequence[i].type === 'practice') {
            lastPracticeIndex = i;
          } else {
            break; // 遇到非练习视频就停止
          }
        }
        
        // 在最后一个练习视频之后插入重试视频
        console.log(`将跳过的练习视频 ${baseVideoId} 安排在位置 ${lastPracticeIndex + 1} (最后一个练习视频之后)`);
        this.videoSequence.splice(lastPracticeIndex + 1, 0, videoToReinsert);
        
        return;
      }
      
      // 对于实验视频使用以下逻辑
      // 如果是填充试次，直接跳过，不再安排重复
      if (currentVideo.isFiller) {
        console.log(`跳过的视频 ${videoId} 是填充试次，不再安排重复`);
        this.recordTrialResult(videoId, true, null, 3); // 记录为填充试次被跳过
        return;
      }
      
      // 如果是第二次跳过或重试被跳过，标记为永久跳过
      if (newSkipCount >= 2 || isRetry) {
        console.log(`视频 ${baseVideoId} 被永久跳过 (第${newSkipCount}次跳过或重试被跳过)`);
        this.recordTrialResult(videoId, true, null, 2); // 记录为永久跳过
        return;
      }
      
      // 第一次跳过，记录并安排重试
      console.log(`视频 ${baseVideoId} 第一次被跳过，安排重试`);
      this.recordTrialResult(videoId, true, null, 1); // 记录为跳过一次
      
      // 创建重试视频
      const videoToReinsert = {
        ...currentVideo,
        id: `${baseVideoId}_retry_1`,
        originalName: currentVideo.originalName,
        isRetry: true
      };
      
      // 使用自定义方法安排重试视频在队列中的位置
      this.arrangeRetryVideoPosition(videoToReinsert);
    }

    // 插入重试视频和填充试次
    insertWithFillers(videoToReinsert) {
      console.log('开始插入重试视频和填充试次');
      
      // 获取已完成的视频作为填充试次
      const completedVideos = this.videoSequence
        .slice(0, this.currentTrialIndex)
        .filter(v => !v.isFiller && !v.isRetry && !this.skippedVideos.get(v.id));
      
      // 随机选择最多2个填充试次
      const numFillers = Math.min(2, completedVideos.length);
      const selectedFillers = [];
      
      if (numFillers > 0) {
        // 随机打乱并选择填充试次
        const shuffled = [...completedVideos].sort(() => Math.random() - 0.5);
        selectedFillers.push(...shuffled.slice(0, numFillers));
      }
      
      // 创建填充试次对象
      const fillerVideos = selectedFillers.map((video, index) => ({
        ...video,
        id: `${video.id}_filler_${index + 1}`,
        isFiller: true,
        originalName: video.originalName
      }));
      
      // 构建最终序列：填充试次 + 重试视频 + 填充试次
      const finalSequence = [
        ...fillerVideos.slice(0, Math.ceil(numFillers / 2)), // 前半部分填充
        videoToReinsert,
        ...fillerVideos.slice(Math.ceil(numFillers / 2)) // 后半部分填充
      ];
      
      console.log(`插入序列: ${finalSequence.map(v => v.id).join(' -> ')}`);
      
      // 将序列添加到视频队列末尾
      this.videoSequence.push(...finalSequence);
    }
    
    // 随机化数组
    shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
}

// 导出 ExperimentController 类
export default ExperimentController; 