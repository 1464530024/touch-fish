/**
 * touch fish · 桌面伪装项定义（虚拟桌面 / 设置页 / 台球模式共用）
 * 图标优先使用从本机 Windows 10 提取的真实系统图标（assets/icons/png），
 * 第三方软件品牌图标使用内置矢量图。
 */

// role: cue = 台球白球；pocket = 球洞；ball = 彩色球
const BASE_ITEMS = [
  { id: 'this-pc', name: '此电脑', icon: 'this-pc', type: 'system', role: 'cue', x: 0, y: 0 },
  { id: 'recycle-bin', name: '回收站', icon: 'recycle-bin', type: 'system', role: 'pocket', x: 0, y: 1 },
  { id: 'app-wechat', name: '微信', icon: 'wechat', type: 'app', role: 'ball', x: 0, y: 2 },
  { id: 'app-chrome', name: 'Google Chrome', icon: 'chrome', type: 'app', role: 'ball', x: 0, y: 3 },
  { id: 'app-edge', name: 'Microsoft Edge', icon: 'edge', type: 'app', role: 'ball', x: 0, y: 4 },
  { id: 'app-word', name: 'Word 文档', icon: 'word', type: 'app', role: 'ball', x: 0, y: 5 },
  { id: 'app-explorer', name: '资源管理器', icon: 'explorer', type: 'app', role: 'ball', x: 0, y: 6 },
  { id: 'app-notepad', name: '记事本', icon: 'notepad', type: 'app', role: 'ball', x: 0, y: 7 },
  { id: 'app-netease', name: '网易云音乐', icon: 'netease', type: 'app', role: 'ball', x: 0, y: 8 },
  { id: 'app-dingtalk', name: '钉钉', icon: 'dingtalk', type: 'app', role: 'ball', x: 0, y: 9 }
];

const DEFAULT_SITES = [
  { id: 's-qidian', name: '起点中文网', url: 'https://www.qidian.com', icon: 'novel' },
  { id: 's-fanqie', name: '番茄小说', url: 'https://fanqienovel.com', icon: 'novel' },
  { id: 's-bilibili', name: '哔哩哔哩', url: 'https://www.bilibili.com', icon: 'bilibili' },
  { id: 's-vqq', name: '腾讯视频', url: 'https://v.qq.com', icon: 'video' }
];

module.exports = { BASE_ITEMS, DEFAULT_SITES };
