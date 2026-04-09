import { Request } from 'express';

export interface User {
    id: number;
    email: string;
    password: string;
    created_at: Date;
    updated_at: Date;
}

export interface FileRecord {
    id: number;
    file_key: string;
    file_type: 'file' | 'text' | 'url';
    file_name?: string;
    file_size: number;
    encrypted_content?: string; // text, url 타입에만 사용
    total_chunks: number; // 파일 타입의 총 청크 수
    iv: string;
    password_hash: string;
    salt: string;
    uploader_ip: string;
    uploader_user_id?: number;
    is_downloaded: boolean;
    upload_completed: boolean;
    created_at: Date;
    expires_at: Date;
    deleted_at?: Date;
}

export interface FileChunk {
    id: number;
    file_id: number;
    chunk_index: number;
    chunk_size: number;
    chunk_path: string;
    created_at: Date;
}

export interface IPStorage {
    id: number;
    ip_address: string;
    total_storage: number;
    last_updated: Date;
}

export interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
    };
}
