/**
 * 明镜 CLI — 配置管理
 * 管理 ~/.lobster/config.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface LobsterConfig {
  /** 当前 agent ID */
  agentId: string;
  /** 学号 */
  studentId?: string;
  /** 院系 */
  department?: string;
  /** 入学时间 */
  enrolledAt?: string;
  /** 签名密钥对 */
  signingKey?: string;
  publicKey?: string;
  /** API Key（cloud 模式） */
  apiKey?: string;
  /** 存储模式 */
  mode?: 'local' | 'cloud';
}

const CONFIG_DIR = path.join(os.homedir(), '.lobster');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/** 确保配置目录存在 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/** 读取配置 */
export function loadConfig(): LobsterConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as LobsterConfig;
  } catch {
    return null;
  }
}

/** 保存配置 */
export function saveConfig(config: LobsterConfig): void {
  ensureConfigDir();
  // 设置目录权限为 0o700（仅 owner 可访问）
  fs.chmodSync(CONFIG_DIR, 0o700);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

/** 更新配置（合并） */
export function updateConfig(partial: Partial<LobsterConfig>): LobsterConfig {
  const existing = loadConfig() ?? { agentId: '' };
  const merged = { ...existing, ...partial };
  saveConfig(merged);
  return merged;
}

/** 获取配置文件路径 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}
