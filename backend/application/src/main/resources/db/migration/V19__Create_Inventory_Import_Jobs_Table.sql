-- Create Inventory Import Jobs Table

CREATE TABLE IF NOT EXISTS inventory_import_jobs (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    pharmacy_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    detected_mappings TEXT,
    parsed_data TEXT,
    error_message TEXT,
    CONSTRAINT fk_import_job_pharmacy FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_pharmacy ON inventory_import_jobs(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON inventory_import_jobs(status);
