import CryptoJS from "crypto-js";

const SECRET = process.env.ENCRYPTION_SECRET!;

export function encryptApiKey(apiKey: string): string {
  return CryptoJS.AES.encrypt(apiKey, SECRET).toString();
}

export function decryptApiKey(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}
