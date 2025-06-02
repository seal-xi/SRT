// 配置管理器
class ConfigManager {
  constructor() {
    this.configPath = 'config/';
    this.texts = {};
  }
  
  // 添加加载文本文件的方法
  async loadTextFile(filename) {
    try {
      console.log(`尝试加载文件: ${this.configPath}${filename}`);
      const response = await fetch(`${this.configPath}${filename}`);
      
      if (!response.ok) {
        console.warn(`文件加载失败: ${filename}, 状态码: ${response.status}`);
        throw new Error(`无法加载文件 ${filename}: ${response.statusText}`);
      }
      
      const text = await response.text();
      console.log(`文件 ${filename} 加载成功, 内容长度: ${text.length}`);
      console.log(`内容预览: ${text.substring(0, 50)}...`);
      return text;
    } catch (error) {
      console.warn(`无法加载文本文件 ${filename}: ${error.message}`);
      const defaultText = this.getDefaultText(filename);
      console.log(`使用默认文本: ${defaultText.substring(0, 50)}...`);
      return defaultText;
    }
  }
  
  // 添加获取默认文本的方法
  getDefaultText(filename) {
    const defaults = {
      'welcome.txt': '欢迎参加手语复述实验！请仔细阅读指导语并按照指示完成实验。',
      'text_instruction_1.txt': '本实验旨在研究手语复述能力。请观看手语视频，然后复述您所看到的内容。',
      'text_instruction_2.txt': '视频结束后，您将看到"录制"和"跳过"两个按钮。如果您理解了视频内容，请点击"录制"进行复述。',
      'text_instruction_3.txt': '如果您不理解视频内容，可以点击"跳过"。被跳过的视频将在稍后重新播放一次。',
      'practice_intro.txt': '现在您将进行3个练习试次，以熟悉实验流程。',
      'exp_endintro.txt': '实验已结束，感谢您的参与！请联系实验员。'
    };
    return defaults[filename] || '配置文本加载失败';
  }
  
  // 获取文本内容
  getText(type) {
    return this.texts[type] || '';
  }

  // 获取文本内容
  getText(type, index = 0) {
    if (type === 'instructions') {
      return this.texts.instructions[index] || '';
    }
    return this.texts[type] || '';
  }
  
  // 检查必要的配置文件是否存在
  async checkRequiredFiles() {
    const requiredFiles = [
      'welcome.txt',
      'text_instruction_1.txt',
      'text_instruction_2.txt',
      'text_instruction_3.txt',
      'practice_intro.txt',
      'exp_endintro.txt'
    ];
    
    const missingFiles = [];
    
    for (const file of requiredFiles) {
      try {
        const response = await fetch(`${this.configPath}${file}`);
        if (!response.ok) {
          missingFiles.push(file);
        }
      } catch (error) {
        missingFiles.push(file);
      }
    }
    
    return {
      valid: missingFiles.length === 0,
      missingFiles
    };
  }
  
  // 加载所有配置文件
  async loadAllConfigs() {
    try {
      // 加载文本文件
      const textFiles = [
        'welcome.txt',
        'text_instruction_1.txt',
        'text_instruction_2.txt',
        'text_instruction_3.txt',
        'practice_intro.txt',
        'exp_endintro.txt'
      ];
      
      for (const file of textFiles) {
        const content = await this.loadTextFile(file);
        const key = file.replace('.txt', '');
        this.texts[key] = content;
      }
      
      return true;
    } catch (error) {
      console.error('加载配置文件失败:', error);
      return false;
    }
  }
}

// 导出 ConfigManager 类
export default ConfigManager; 