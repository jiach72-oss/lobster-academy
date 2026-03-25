/**
 * 龙虾学院 Blackbox — CLI 报告生成命令
 * 从本地存储的记录中生成审计报告
 * 
 * Usage: npx lobster-report [--from 2026-03-01] [--to 2026-03-31] [--format text|json]
 */

import { LobsterBlackbox } from '../src/index';
import { DecisionRecord } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

interface ReportOptions {
  inputDir?: string;
  outputPath?: string;
  format: 'text' | 'json' | 'html' | 'markdown';
  from?: string;
  to?: string;
}

/**
 * 从本地 JSON 文件加载记录
 */
function loadRecords(dir: string): DecisionRecord[] {
  const records: DecisionRecord[] = [];
  
  if (!fs.existsSync(dir)) {
    return records;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      if (Array.isArray(data)) {
        records.push(...data);
      } else if (data.id && data.agentId) {
        records.push(data);
      }
    } catch {
      // 跳过无效文件
    }
  }

  return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

async function generateReport(options: ReportOptions): Promise<void> {
  const box = new LobsterBlackbox({ agentId: 'report-generator' });

  // 加载记录
  const inputDir = options.inputDir ?? './lobster-records';
  const records = loadRecords(inputDir);

  if (records.length === 0) {
    console.log('ℹ️ 未找到记录文件。请确保:');
    console.log(`   1. 记录目录存在: ${inputDir}`);
    console.log('   2. 目录中有 .json 格式的记录文件');
    console.log('');
    console.log('💡 提示: 使用 SDK 的 recorder.getRecords() 导出记录');
    return;
  }

  console.log(`📥 加载了 ${records.length} 条记录`);

  // 录入到黑匣子
  for (const record of records) {
    await box.record({
      type: record.type,
      input: record.input,
      reasoning: record.reasoning,
      output: record.output,
      toolCalls: record.toolCalls,
      duration: record.duration,
      metadata: { ...record.metadata, originalId: record.id },
    });
  }

  // 生成报告
  const report = box.generateReport({ from: options.from, to: options.to });

  // 输出
  if (options.format === 'json') {
    const json = box.toJSON(report);
    if (options.outputPath) {
      fs.writeFileSync(options.outputPath, json);
      console.log(`📄 JSON 报告已保存: ${options.outputPath}`);
    } else {
      console.log(json);
    }
  } else if (options.format === 'html') {
    const html = box.toHTML(report);
    const outPath = options.outputPath ?? 'report.html';
    fs.writeFileSync(outPath, html);
    console.log(`📄 HTML 报告已保存: ${outPath}`);
  } else if (options.format === 'markdown') {
    const md = box.toMarkdown(report);
    if (options.outputPath) {
      fs.writeFileSync(options.outputPath, md);
      console.log(`📄 Markdown 报告已保存: ${options.outputPath}`);
    } else {
      console.log(md);
    }
  } else {
    const text = box.toText(report);
    if (options.outputPath) {
      fs.writeFileSync(options.outputPath, text);
      console.log(`📄 文本报告已保存: ${options.outputPath}`);
    } else {
      console.log(text);
    }
  }
}

function printHelp(): void {
  console.log(`
🦞 lobster-report — 龙虾学院审计报告生成工具

用法:
  lobster-report [选项]

选项:
  --input <dir>      记录文件目录（默认 ./lobster-records）
  --output <file>    输出文件路径
  --format <fmt>     输出格式: text (默认), json, html, markdown
  --from <date>      起始日期过滤（ISO8601，如 2026-03-01）
  --to <date>        截止日期过滤（ISO8601，如 2026-03-31）
  --help, -h         显示此帮助信息

示例:
  lobster-report
  lobster-report --input ./data --format json --output report.json
  lobster-report --format html --output report.html
  lobster-report --format markdown --output report.md
  lobster-report --from 2026-03-01 --to 2026-03-31 --format json
  lobster-report --help
`);
}

// --- CLI入口 ---
const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

// Check for --help first
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

// Check for unknown flags
const knownFlags = new Set(['--input', '--output', '--format', '--from', '--to', '--help', '-h']);
for (const arg of args) {
  if (arg.startsWith('-') && !knownFlags.has(arg)) {
    console.error(`❌ 未知选项: ${arg}\n使用 --help 查看可用选项`);
    process.exit(1);
  }
}

// Validate format
const rawFormat = getArg('--format');
const validFormats = ['text', 'json', 'html', 'markdown'] as const;
type ValidFormat = (typeof validFormats)[number];
const format: ValidFormat = (validFormats as readonly string[]).includes(rawFormat ?? '')
  ? (rawFormat as ValidFormat)
  : 'text';

if (rawFormat && !validFormats.includes(rawFormat as ValidFormat)) {
  console.error(`❌ 不支持的格式: ${rawFormat}（支持 text, json, html, markdown）`);
  process.exit(1);
}

generateReport({
  inputDir: getArg('--input') ?? './lobster-records',
  outputPath: getArg('--output'),
  format,
  from: getArg('--from'),
  to: getArg('--to'),
}).catch(err => {
  console.error('❌ 报告生成失败:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
