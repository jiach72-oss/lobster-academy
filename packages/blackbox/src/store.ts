/** 本地存储模块 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { BlackboxRecord } from './types';

export class Store {
  private basePath: string;

  constructor(storagePath: string = './blackbox-data') {
    this.basePath = storagePath;
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  /** 存储一条记录 */
  save(record: BlackboxRecord): void {
    const date = record.timestamp.slice(0, 10); // YYYY-MM-DD
    const dir = join(this.basePath, record.agent_id, date);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const file = join(dir, `${record.id}.json`);
    writeFileSync(file, JSON.stringify(record, null, 2), 'utf-8');
  }

  /** 批量存储 */
  saveBatch(records: BlackboxRecord[]): void {
    for (const record of records) {
      this.save(record);
    }
  }

  /** 按日期范围查询 */
  query(agentId: string, from?: string, to?: string): BlackboxRecord[] {
    const agentDir = join(this.basePath, agentId);
    if (!existsSync(agentDir)) return [];

    const records: BlackboxRecord[] = [];
    const dates = readdirSync(agentDir).filter(d => {
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }).sort();

    for (const date of dates) {
      const dateDir = join(agentDir, date);
      try {
        const files = readdirSync(dateDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            const data = readFileSync(join(dateDir, file), 'utf-8');
            records.push(JSON.parse(data));
          } catch { /* skip corrupted */ }
        }
      } catch { /* skip */ }
    }

    return records;
  }

  /** 获取统计 */
  stats(agentId: string): { totalRecords: number; dates: string[] } {
    const agentDir = join(this.basePath, agentId);
    if (!existsSync(agentDir)) return { totalRecords: 0, dates: [] };

    let total = 0;
    const dates = readdirSync(agentDir).sort();
    for (const date of dates) {
      try {
        const files = readdirSync(join(agentDir, date)).filter(f => f.endsWith('.json'));
        total += files.length;
      } catch { /* skip */ }
    }

    return { totalRecords: total, dates };
  }
}
