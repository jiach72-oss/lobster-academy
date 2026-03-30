/** 用 HMAC-SHA256 做确定性签名（Ed25519 需要 nacl，先用 HMAC 实现，后续升级） */
export declare class Signer {
    private privateKey;
    private publicKeyHex;
    constructor(privateKeyHex?: string);
    /** 签名任意数据，返回 hex 签名 */
    sign(data: string | object): string;
    /** 验证签名 */
    verify(data: string | object, signature: string): boolean;
    /** 获取公钥 (hex) */
    getPublicKey(): string;
    /** 获取私钥 (hex) */
    getPrivateKey(): string;
    /** 计算内容哈希 */
    static hash(data: string): string;
}
