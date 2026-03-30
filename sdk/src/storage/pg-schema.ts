/**
 * 明镜 Blackbox SDK — PostgreSQL Schema (Drizzle ORM)
 * 覆盖 PRD 中所有数据实体
 */

import {
  pgTable, uuid, varchar, text, integer, real, boolean, timestamp, jsonb,
  index, uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────
// Users 用户表
// ─────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_users_username').on(table.username),
]);

// ─────────────────────────────────────────────
// Agents 代理表
// ─────────────────────────────────────────────
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: varchar('agent_id', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  userId: uuid('user_id').references(() => users.id),
  department: varchar('department', { length: 100 }).default('general'),
  status: varchar('status', { length: 50 }).default('active'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_agents_agent_id').on(table.agentId),
  index('idx_agents_user_id').on(table.userId),
]);

// ─────────────────────────────────────────────
// Recordings 录制记录表
// ─────────────────────────────────────────────
export const recordings = pgTable('recordings', {
  id: uuid('id').primaryKey(),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // decision | tool_call | error | system
  input: jsonb('input').notNull(),
  reasoning: text('reasoning'),
  output: jsonb('output').notNull(),
  toolCalls: jsonb('tool_calls').default([]),
  duration: integer('duration'), // ms
  signature: text('signature'),
  hash: varchar('hash', { length: 64 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_recordings_agent_id').on(table.agentId),
  index('idx_recordings_timestamp').on(table.timestamp),
  index('idx_recordings_type').on(table.type),
  index('idx_recordings_agent_timestamp').on(table.agentId, table.timestamp),
]);

// ─────────────────────────────────────────────
// Reports 审计报告表
// ─────────────────────────────────────────────
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey(),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  periodFrom: timestamp('period_from', { withTimezone: true }).notNull(),
  periodTo: timestamp('period_to', { withTimezone: true }).notNull(),
  summary: jsonb('summary').notNull(), // ReportSummary
  anomalies: jsonb('anomalies').default([]),
  signature: text('signature'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_reports_agent_id').on(table.agentId),
  index('idx_reports_generated_at').on(table.generatedAt),
]);

// ─────────────────────────────────────────────
// Evaluations 评测记录表
// ─────────────────────────────────────────────
export const evaluations = pgTable('evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  sequence: integer('sequence').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  dimensions: jsonb('dimensions').notNull(), // { security, reliability, observability, compliance, explainability }
  totalScore: real('total_score').notNull(),
  grade: varchar('grade', { length: 5 }).notNull(), // S | A | B | C | D
  agentVersion: varchar('agent_version', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_evaluations_agent_id').on(table.agentId),
  index('idx_evaluations_agent_sequence').on(table.agentId, table.sequence),
]);

// ─────────────────────────────────────────────
// Skills 技能库表（33个默认技能）
// ─────────────────────────────────────────────
export const skills = pgTable('skills', {
  id: varchar('id', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  description: text('description').notNull(),
  dimension: varchar('dimension', { length: 100 }).notNull(),
  maxScore: integer('max_score').notNull(),
  checkMethod: text('check_method').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_skills_category').on(table.category),
  index('idx_skills_dimension').on(table.dimension),
]);

// ─────────────────────────────────────────────
// Signatures 签名记录表
// ─────────────────────────────────────────────
export const signatures = pgTable('signatures', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  recordId: varchar('record_id', { length: 255 }).notNull(),
  algorithm: varchar('algorithm', { length: 50 }).notNull().default('ed25519'),
  publicKey: text('public_key').notNull(),
  signature: text('signature').notNull(),
  dataHash: varchar('data_hash', { length: 64 }).notNull(),
  verified: boolean('verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_signatures_agent_id').on(table.agentId),
  index('idx_signatures_record_id').on(table.recordId),
]);
