// 암호화 키 생성
export async function generateEncryptionKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256,
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );
}

// CryptoKey -> base64 문자열로 변환 (URL 해시에 저장하기 위함)
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    const exportedKeyBuffer = new Uint8Array(exported);
    return btoa(String.fromCharCode(...exportedKeyBuffer));
}

// base64 문자열 -> CryptoKey로 변환
export async function importKeyFromBase64(base64Key: string): Promise<CryptoKey> {
    const keyBuffer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        {
            name: 'AES-GCM',
            length: 256,
        },
        true,
        ['encrypt', 'decrypt']
    );
}

// 텍스트 암호화
export async function encryptText(text: string, key: CryptoKey): Promise<{
    encrypted: string;
    iv: string;
}> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // iv 만들기
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // 암호화
    const encryptedData = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv,
        },
        key,
        data
    );
    
    return {
        encrypted: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
        iv: btoa(String.fromCharCode(...iv)),
    };
}

// 텍스트 복호화
export async function decryptText(
    encryptedBase64: string,
    ivBase64: string,
    key: CryptoKey
): Promise<string> {
    const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    
    const decryptedData = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv,
        },
        key,
        encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
}

// array buffer를 base64로 변환
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    // 32KB 청크로 처리 (오버플로우 방지)
    const chunkSize = 0x8000;
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode(...chunk);
    }
    
    return btoa(binary);
}

// Base64를 ArrayBuffer로 변환
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
}

// 비밀번호로부터 암호화 키 유도 (PBKDF2)
export async function deriveKeyFromPassword(
    password: string,
    salt?: Uint8Array
): Promise<{
    key: CryptoKey;
    salt: string;
}> {

    // 비밀번호를 키 material로 변환
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    // PBKDF2로 키 유도
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            //@ts-ignore
            salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        {
            name: 'AES-GCM',
            length: 256,
        },
        true,
        ['encrypt', 'decrypt']
    );
    
    return {
        key,
        salt: btoa(String.fromCharCode(...(salt as Uint8Array))),
    };
}

/**
 *  salt 값으로 키 유도
 */
export async function deriveKeyFromPasswordWithSalt(
    password: string,
    saltBase64: string
): Promise<CryptoKey> {
    const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    const { key } = await deriveKeyFromPassword(password, salt);
    return key;
}

/**
 *  StreamSaver 이용해서 스트림 방식으로 청크 복호화 후 저장함
 *  !!! 대용량 파일 다운로드 받을 때는 이걸로 써야함 !!!
 */
export async function decryptFileChunksStreaming(
    downloadChunk: (index: number) => Promise<ArrayBuffer>,
    totalChunks: number,
    ivBase64: string,
    key: CryptoKey,
    writer: WritableStreamDefaultWriter,
    onProgress?: (downloadPercent: number, decryptPercent: number) => void
): Promise<void> {
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

    for (let i = 0; i < totalChunks; i++) {

        // 청크 다운로드
        const encryptedChunk = await downloadChunk(i);
        
        if (onProgress) {
            const downloadPercent = Math.round(((i + 1) / totalChunks) * 100);
            onProgress(downloadPercent, 0);
        }

        // 청크 복호화
        const decryptedData = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv,
            },
            key,
            encryptedChunk
        );

        // 스트림에 즉시 쓰기
        await writer.write(new Uint8Array(decryptedData));

        if (onProgress) {
            const decryptPercent = Math.round(((i + 1) / totalChunks) * 100);
            onProgress(100, decryptPercent);
        }
    }

    await writer.close();
}
