ALTER TABLE pharmacies ADD COLUMN user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_pharmacies_user ON pharmacies(user_id);
