-- ============================================================
-- 龙虾学院 Blackbox — 数据库初始化脚本
-- PostgreSQL Schema 创建
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Users 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================================
-- Agents 代理表
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  user_id UUID REFERENCES users(id),
  department VARCHAR(100) DEFAULT 'general',
  status VARCHAR(50) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);

-- ============================================================
-- Recordings 录制记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  type VARCHAR(50) NOT NULL,
  input JSONB NOT NULL,
  reasoning TEXT,
  output JSONB NOT NULL,
  tool_calls JSONB DEFAULT '[]',
  duration INTEGER,
  signature TEXT,
  hash VARCHAR(64),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recordings_agent_id ON recordings(agent_id);
CREATE INDEX IF NOT EXISTS idx_recordings_timestamp ON recordings(timestamp);
CREATE INDEX IF NOT EXISTS idx_recordings_type ON recordings(type);
CREATE INDEX IF NOT EXISTS idx_recordings_agent_timestamp ON recordings(agent_id, timestamp);

-- ============================================================
-- Reports 审计报告表
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  period_from TIMESTAMPTZ NOT NULL,
  period_to TIMESTAMPTZ NOT NULL,
  summary JSONB NOT NULL,
  anomalies JSONB DEFAULT '[]',
  signature TEXT,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_agent_id ON reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at);

-- ============================================================
-- Evaluations 评测记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(255) NOT NULL,
  sequence INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  dimensions JSONB NOT NULL,
  total_score REAL NOT NULL,
  grade VARCHAR(5) NOT NULL,
  agent_version VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evaluations_agent_id ON evaluations(agent_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_agent_sequence ON evaluations(agent_id, sequence);

-- ============================================================
-- Skills 技能库表
-- ============================================================
CREATE TABLE IF NOT EXISTS skills (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  dimension VARCHAR(100) NOT NULL,
  max_score INTEGER NOT NULL,
  check_method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_dimension ON skills(dimension);

-- ============================================================
-- Signatures 签名记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  algorithm VARCHAR(50) NOT NULL DEFAULT 'ed25519',
  public_key TEXT NOT NULL,
  signature TEXT NOT NULL,
  data_hash VARCHAR(64) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signatures_agent_id ON signatures(agent_id);
CREATE INDEX IF NOT EXISTS idx_signatures_record_id ON signatures(record_id);

-- ============================================================
-- 自动更新 updated_at 触发器
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_agents_updated_at ON agents;
CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
