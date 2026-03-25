#!/usr/bin/env ts-node
/**
 * 龙虾学院 Blackbox — 数据库迁移工具
 *
 * 用法：
 *   npx ts-node migrations/run.ts init    # 创建表结构
 *   npx ts-node migrations/run.ts seed    # 填充种子数据
 *   npx ts-node migrations/run.ts all     # init + seed
 *   npx ts-node migrations/run.ts reset   # 删除所有表（危险！）
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import * as readline from 'readline';

const MIGRATIONS_DIR = __dirname;

/** 确认危险操作 */
async function confirmAction(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${prompt} (yes/NO): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function run() {
  const command = process.argv[2] ?? 'all';
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL 环境变量未设置');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const client = await pool.connect();
    console.log('✅ 数据库连接成功\n');

    try {
      switch (command) {
        case 'init':
          await runFile(client, '001_init.sql');
          break;

        case 'seed':
          await runFile(client, '002_seed_skills.sql');
          break;

        case 'all':
          await runFile(client, '001_init.sql');
          await runFile(client, '002_seed_skills.sql');
          break;

        case 'reset':
          if (!(await confirmAction('⚠️  即将删除所有数据库表，此操作不可逆！是否继续？'))) {
            console.log('❌ 操作已取消');
            process.exit(0);
          }
          await resetDatabase(client);
          break;

        default:
          console.error(`未知命令: ${command}`);
          console.error('可用命令: init | seed | all | reset');
          process.exit(1);
      }

      console.log('\n✅ 迁移完成');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ 迁移失败:', (error as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function runFile(client: any, filename: string) {
  const filepath = join(MIGRATIONS_DIR, filename);
  console.log(`📄 执行迁移: ${filename}`);

  const sql = readFileSync(filepath, 'utf-8');
  await client.query(sql);

  console.log(`   ✅ ${filename} 执行成功`);
}

async function resetDatabase(client: any) {
  console.log('⚠️  正在删除所有表...');

  await client.query(`
    DROP TABLE IF EXISTS signatures CASCADE;
    DROP TABLE IF EXISTS skills CASCADE;
    DROP TABLE IF EXISTS evaluations CASCADE;
    DROP TABLE IF EXISTS reports CASCADE;
    DROP TABLE IF EXISTS recordings CASCADE;
    DROP TABLE IF EXISTS agents CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
  `);

  console.log('   ✅ 所有表已删除');
}

run();
