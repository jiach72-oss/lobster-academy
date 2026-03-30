import { BlackboxRecord } from './types';
export declare class Store {
    private basePath;
    constructor(storagePath?: string);
    /** 存储一条记录 */
    save(record: BlackboxRecord): void;
    /** 批量存储 */
    saveBatch(records: BlackboxRecord[]): void;
    /** 按日期范围查询 */
    query(agentId: string, from?: string, to?: string): BlackboxRecord[];
    /** 获取统计 */
    stats(agentId: string): {
        totalRecords: number;
        dates: string[];
    };
}
