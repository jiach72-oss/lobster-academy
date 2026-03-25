/**
 * 龙虾学院 Blackbox SDK — 存储模块
 */

export { StorageAdapter, SkillRecord, SignatureRecord } from './storage-adapter';
export { InMemoryStorage } from './in-memory-storage';
export { PgStorage, PgStorageConfig } from './pg-storage';
export { createStorage } from './storage-factory';
export type { StorageFactoryConfig, StorageResult } from './storage-factory';

// Schema 导出（用于迁移工具）
export * as pgSchema from './pg-schema';
