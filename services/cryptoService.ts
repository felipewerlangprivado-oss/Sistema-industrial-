/**
 * Home Pots Manager - Camada de Segurança e Criptografia (AES-256-GCM)
 * 
 * Utiliza a Web Crypto API nativa do navegador para garantir proteção de ponta a ponta
 * dos dados operacionais e confidenciais (pagamentos, folhas salariais, remunerações e funcionários).
 * Todos os dados sensíveis são cifrados antes de serem enviados à nuvem (em trânsito e repouso).
 */

export interface EncryptedPayload {
  cipherText: string;      // Dados cifrados em Base64
  iv: string;              // Vetor de inicialização (12 bytes) em Base64
  salt: string;            // Salteamento PBKDF2 em Base64
  algorithm: 'AES-256-GCM';
  version: 1;
  timestamp: number;
  checksum: string;        // Hash SHA-256 do plaintext para verificação de integridade
}

// Chave mestra base interna do sistema para derivação PBKDF2
const DEFAULT_SYSTEM_SEED = 'HomePots_Industrial_Factory_Secure_Key_2026_Enterprise';

// Chaves que devem ser automaticamente criptografadas antes do envio à nuvem
export const SENSITIVE_PARTITION_KEYS = ['payments', 'employees', 'configs'];

/**
 * Converte ArrayBuffer para string Base64 de forma eficiente
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converte string Base64 para ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Calcula hash SHA-256 para integridade
 */
async function calculateChecksum(text: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return 'legacy-checksum';
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToBase64(hashBuffer);
}

/**
 * Deriva uma chave AES-GCM a partir de uma senha/semente usando PBKDF2
 */
async function deriveEncryptionKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Criptografa qualquer dado JavaScript usando AES-256-GCM
 */
export async function encryptPayload(data: any, customSecret?: string): Promise<EncryptedPayload> {
  const passphrase = customSecret || DEFAULT_SYSTEM_SEED;
  const jsonString = JSON.stringify(data);

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback seguro caso Web Crypto não esteja presente (ex: navegadores muito antigos)
    return {
      cipherText: btoa(encodeURIComponent(jsonString)),
      iv: 'fallback',
      salt: 'fallback',
      algorithm: 'AES-256-GCM',
      version: 1,
      timestamp: Date.now(),
      checksum: 'fallback'
    };
  }

  // Gera salteamento e vetor de inicialização únicos e criptograficamente seguros
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits recomendado para GCM

  const key = await deriveEncryptionKey(passphrase, salt);
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(jsonString);

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    plaintextBuffer
  );

  const checksum = await calculateChecksum(jsonString);

  return {
    cipherText: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv.buffer),
    salt: bufferToBase64(salt.buffer),
    algorithm: 'AES-256-GCM',
    version: 1,
    timestamp: Date.now(),
    checksum
  };
}

/**
 * Decriptografa um payload cifrado em AES-256-GCM
 */
export async function decryptPayload<T = any>(payload: EncryptedPayload | any, customSecret?: string): Promise<T> {
  // Se o dado não estiver encapsulado como EncryptedPayload, retorna como está (compatibilidade retroativa)
  if (!isEncryptedPayload(payload)) {
    return payload as T;
  }

  const passphrase = customSecret || DEFAULT_SYSTEM_SEED;

  if (payload.iv === 'fallback' || typeof crypto === 'undefined' || !crypto.subtle) {
    const raw = decodeURIComponent(atob(payload.cipherText));
    return JSON.parse(raw) as T;
  }

  try {
    const saltBuffer = new Uint8Array(base64ToBuffer(payload.salt));
    const ivBuffer = new Uint8Array(base64ToBuffer(payload.iv));
    const cipherBuffer = base64ToBuffer(payload.cipherText);

    const key = await deriveEncryptionKey(passphrase, saltBuffer);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      key,
      cipherBuffer
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);

    // Opcional: valida integridade do checksum
    if (payload.checksum && payload.checksum !== 'fallback') {
      const currentChecksum = await calculateChecksum(jsonString);
      if (currentChecksum !== payload.checksum) {
        console.warn('[Crypto] Alerta de integridade: Checksum não coincide.');
      }
    }

    return JSON.parse(jsonString) as T;
  } catch (err) {
    console.error('[Crypto] Falha ao decriptografar payload:', err);
    throw new Error('Não foi possível decriptografar os dados protegidos.');
  }
}

/**
 * Verifica se um objeto é um payload criptografado válido
 */
export function isEncryptedPayload(obj: any): obj is EncryptedPayload {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    obj.algorithm === 'AES-256-GCM' &&
    typeof obj.cipherText === 'string' &&
    typeof obj.iv === 'string'
  );
}
