import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ALGORITHM = 'aes-256-gcm';

// We must ensure a 32-byte key is used.
// If ENCRYPTION_KEY is provided in hex, use it. Otherwise, fall back to a dummy key in development.
const getMasterKey = () => {
    const keyStr = process.env.ENCRYPTION_KEY;
    if (keyStr) {
        // Assume hex string of 64 chars = 32 bytes
        const buf = Buffer.from(keyStr, 'hex');
        if (buf.length === 32) return buf;
    }
    // Fallback for development if not provided - NOT SECURE FOR PRODUCTION
    console.warn("⚠️ ENCRYPTION_KEY not set or invalid. Using insecure fallback key!");
    return crypto.createHash('sha256').update(String(process.env.SECRET_KEY || 'default-fallback')).digest();
};

const MASTER_KEY = getMasterKey();

export const encrypt = (plaintext) => {
    if (!plaintext) return plaintext;
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err) {
        console.error("Encryption error:", err);
        return null;
    }
};

export const decrypt = (ciphertext) => {
    if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.includes(':')) {
        return ciphertext; // Could be already decrypted or not encrypted
    }
    try {
        const parts = ciphertext.split(':');
        if (parts.length !== 3) return ciphertext;
        const [ivHex, authTagHex, encrypted] = parts;
        const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error("Decryption error:", err);
        return null;
    }
};
