/**
 * Storage Adapter Tests
 * Uses mocks to avoid requiring actual service connections.
 */

import { ElasticsearchStorage } from '../src/storage/elasticsearch-storage';
import { S3Storage } from '../src/storage/s3-storage';

// ═══════════════════════════════════════════
// Elasticsearch Tests
// ═══════════════════════════════════════════

describe('ElasticsearchStorage', () => {
  let storage: ElasticsearchStorage;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      indices: { exists: jest.fn().mockResolvedValue(true), create: jest.fn() },
      index: jest.fn().mockResolvedValue({}),
      search: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
      count: jest.fn().mockResolvedValue({ count: 0 }),
      deleteByQuery: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue(undefined),
      bulk: jest.fn().mockResolvedValue({ errors: false, items: [] }),
    };

    jest.mock('@elastic/elasticsearch', () => ({
      Client: jest.fn().mockImplementation(() => mockClient),
    }));

    // Need to re-require after mock
    jest.resetModules();
  });

  test('should save a record', async () => {
    const { ElasticsearchStorage: ES } = require('../src/storage/elasticsearch-storage');
    const store = new ES({ node: 'http://localhost:9200' });
    await store.initialize();

    const record = {
      id: 'test-001',
      agentId: 'agent-001',
      timestamp: new Date().toISOString(),
      type: 'decision' as const,
      input: { query: 'hello' },
      output: { result: 'world' },
    };

    await store.saveRecord(record);
    expect(mockClient.index).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-001' })
    );
  });

  test('should search with query', async () => {
    const { ElasticsearchStorage: ES } = require('../src/storage/elasticsearch-storage');
    const store = new ES({ node: 'http://localhost:9200' });
    await store.initialize();

    mockClient.search.mockResolvedValue({
      hits: {
        hits: [
          { _source: { id: 'r1', agentId: 'a1', input: { text: 'error' } } },
        ],
      },
    });

    const results = await store.search('error', { agentId: 'a1', size: 5 });
    expect(mockClient.search).toHaveBeenCalled();
  });

  test('should count records', async () => {
    const { ElasticsearchStorage: ES } = require('../src/storage/elasticsearch-storage');
    const store = new ES({ node: 'http://localhost:9200' });
    await store.initialize();

    mockClient.count.mockResolvedValue({ count: 42 });
    const count = await store.countRecords('agent-001');
    expect(count).toBe(42);
  });
});

// ═══════════════════════════════════════════
// S3 Tests
// ═══════════════════════════════════════════

describe('S3Storage', () => {
  let mockS3Client: any;

  beforeEach(() => {
    mockS3Client = {
      send: jest.fn().mockResolvedValue({}),
      destroy: jest.fn(),
    };

    jest.mock('@aws-sdk/client-s3', () => ({
      S3Client: jest.fn().mockImplementation(() => mockS3Client),
      PutObjectCommand: jest.fn().mockImplementation((args) => args),
      GetObjectCommand: jest.fn().mockImplementation((args) => args),
      ListObjectsV2Command: jest.fn().mockImplementation((args) => args),
      DeleteObjectsCommand: jest.fn().mockImplementation((args) => args),
      HeadBucketCommand: jest.fn().mockImplementation((args) => args),
    }));

    jest.resetModules();
  });

  test('should save record to buffer', async () => {
    const { S3Storage: S3 } = require('../src/storage/s3-storage');
    const store = new S3({ bucket: 'test-bucket' });
    await store.initialize();

    const record = {
      id: 'r1',
      agentId: 'agent-001',
      timestamp: new Date().toISOString(),
      type: 'decision' as const,
      input: { q: 'hello' },
      output: { a: 'world' },
    };

    await store.saveRecord(record);
    const records = await store.getRecords('agent-001');
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('r1');
  });

  test('should archive session to S3', async () => {
    const { S3Storage: S3 } = require('../src/storage/s3-storage');
    const store = new S3({ bucket: 'test-bucket' });
    await store.initialize();

    await store.saveRecord({
      id: 'r1', agentId: 'agent-001',
      timestamp: new Date().toISOString(),
      type: 'decision' as const,
      input: { q: 'hello' },
      output: { a: 'world' },
    });

    const key = await store.archiveSession('agent-001', 'session-abc');
    expect(key).toContain('agent-001');
    expect(key).toContain('session-abc');
    expect(mockS3Client.send).toHaveBeenCalled();
  });

  test('should throw on empty archive', async () => {
    const { S3Storage: S3 } = require('../src/storage/s3-storage');
    const store = new S3({ bucket: 'test-bucket' });
    await store.initialize();

    await expect(store.archiveSession('agent-001')).rejects.toThrow(
      'No records to archive'
    );
  });
});
