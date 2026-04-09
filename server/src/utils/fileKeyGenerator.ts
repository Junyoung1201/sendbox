export function generateFileKey(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 6자리 다운로드 키 생성
 */
export async function generateUniqueFileKey(
    checkExists: (key: string) => Promise<boolean>
): Promise<string> {
    let key: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
        key = generateFileKey();
        attempts++;

        if (attempts > maxAttempts) {
            throw new Error('Failed to generate unique file key after maximum attempts');
        }
    } while (await checkExists(key));

    return key;
}
