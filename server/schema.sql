
DROP TABLE IF EXISTS file_chunks CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS ip_storage CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE files (
    id SERIAL PRIMARY KEY,

    file_key VARCHAR(6) UNIQUE NOT NULL,
    file_type VARCHAR(10) NOT NULL, -- 'text', 'url', 'file'
    file_name VARCHAR(255),
    file_size BIGINT DEFAULT 0,
    encrypted_content TEXT, 
    total_chunks INTEGER DEFAULT 0, 
    iv VARCHAR(255),
    password_hash VARCHAR(255),
    salt VARCHAR(255),
    is_encrypted BOOLEAN DEFAULT FALSE, 
    uploader_ip VARCHAR(45) NOT NULL,
    uploader_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_downloaded BOOLEAN DEFAULT FALSE,
    upload_completed BOOLEAN DEFAULT FALSE, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP
);

CREATE TABLE file_chunks (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL, 
    chunk_size BIGINT NOT NULL, 
    chunk_path VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, chunk_index)
);

CREATE TABLE ip_storage (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) UNIQUE NOT NULL,
    total_storage BIGINT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_files_file_key ON files(file_key);
CREATE INDEX idx_files_uploader_ip ON files(uploader_ip);
CREATE INDEX idx_files_expires_at ON files(expires_at);
CREATE INDEX idx_file_chunks_file_id ON file_chunks(file_id);
CREATE INDEX idx_file_chunks_file_id_index ON file_chunks(file_id, chunk_index);
CREATE INDEX idx_ip_storage_ip ON ip_storage(ip_address);
CREATE INDEX idx_users_email ON users(email);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
