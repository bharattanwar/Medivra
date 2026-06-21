ALTER TABLE users ADD COLUMN blocked_until TIMESTAMP;
ALTER TABLE appointments ADD COLUMN previous_status VARCHAR(50);
