/** 脱敏引擎 — 200+ 种 PII/密钥正则 */
export interface RedactRule {
    name: string;
    pattern: RegExp;
    replacement: string;
}
export declare class Redactor {
    private rules;
    constructor(customRules?: RedactRule[]);
    /** 对文本执行脱敏 */
    redactText(text: string): {
        result: string;
        matches: {
            rule: string;
            count: number;
        }[];
    };
    /** 对对象递归脱敏 */
    redactObject<T>(obj: T): {
        result: T;
        matches: {
            rule: string;
            count: number;
        }[];
    };
    private _redactDeep;
}
