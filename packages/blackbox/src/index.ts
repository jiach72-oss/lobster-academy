/** @lobster-academy/blackbox — Agent 行为录制与签名引擎 */

export { Blackbox, wrapOpenAI } from './recorder';
export { Redactor } from './redactor';
export { Signer } from './signer';
export { Store } from './store';
export { AnomalyDetector } from './anomaly';
export type {
  BlackboxConfig,
  BlackboxRecord,
  LLMRecord,
  ToolRecord,
  ReasoningRecord,
  AnomalyRecord,
  BlackboxReport,
  ToolDefinition,
  ToolCall,
} from './types';
