"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
/** 本地存储模块 */
const fs_1 = require("fs");
const path_1 = require("path");
class Store {
    constructor(storagePath = './blackbox-data') {
        this.basePath = storagePath;
        if (!(0, fs_1.existsSync)(this.basePath)) {
            (0, fs_1.mkdirSync)(this.basePath, { recursive: true });
        }
    }
    /** 存储一条记录 */
    save(record) {
        const date = record.timestamp.slice(0, 10); // YYYY-MM-DD
        const dir = (0, path_1.join)(this.basePath, record.agent_id, date);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        }
        const file = (0, path_1.join)(dir, `${record.id}.json`);
        (0, fs_1.writeFileSync)(file, JSON.stringify(record, null, 2), 'utf-8');
    }
    /** 批量存储 */
    saveBatch(records) {
        for (const record of records) {
            this.save(record);
        }
    }
    /** 按日期范围查询 */
    query(agentId, from, to) {
        const agentDir = (0, path_1.join)(this.basePath, agentId);
        if (!(0, fs_1.existsSync)(agentDir))
            return [];
        const records = [];
        const dates = (0, fs_1.readdirSync)(agentDir).filter(d => {
            if (from && d < from)
                return false;
            if (to && d > to)
                return false;
            return true;
        }).sort();
        for (const date of dates) {
            const dateDir = (0, path_1.join)(agentDir, date);
            try {
                const files = (0, fs_1.readdirSync)(dateDir).filter(f => f.endsWith('.json'));
                for (const file of files) {
                    try {
                        const data = (0, fs_1.readFileSync)((0, path_1.join)(dateDir, file), 'utf-8');
                        records.push(JSON.parse(data));
                    }
                    catch { /* skip corrupted */ }
                }
            }
            catch { /* skip */ }
        }
        return records;
    }
    /** 获取统计 */
    stats(agentId) {
        const agentDir = (0, path_1.join)(this.basePath, agentId);
        if (!(0, fs_1.existsSync)(agentDir))
            return { totalRecords: 0, dates: [] };
        let total = 0;
        const dates = (0, fs_1.readdirSync)(agentDir).sort();
        for (const date of dates) {
            try {
                const files = (0, fs_1.readdirSync)((0, path_1.join)(agentDir, date)).filter(f => f.endsWith('.json'));
                total += files.length;
            }
            catch { /* skip */ }
        }
        return { totalRecords: total, dates };
    }
}
exports.Store = Store;
//# sourceMappingURL=store.js.map