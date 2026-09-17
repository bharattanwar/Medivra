-- V20__Optimize_Indexes_And_Performance.sql
-- Database index optimization for high performance query execution and latency reduction

-- 1. Pharmacy Inventories & Medicines Indexes
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventories_pharmacy_id ON pharmacy_inventories(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventories_medicine_id ON pharmacy_inventories(medicine_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventories_pharmacy_med ON pharmacy_inventories(pharmacy_id, medicine_id);
CREATE INDEX IF NOT EXISTS idx_medicines_name_lower ON medicines(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);

-- 2. Pharmacy Location & Status Index
CREATE INDEX IF NOT EXISTS idx_pharmacies_active ON pharmacies(active);

-- 3. Appointments & Payments Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id);

-- 4. Medicine Orders Indexes
CREATE INDEX IF NOT EXISTS idx_medicine_orders_patient_id ON medicine_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_medicine_orders_status ON medicine_orders(status);

-- 5. Emergency Requests Index
CREATE INDEX IF NOT EXISTS idx_emergency_requests_status_created ON emergency_requests(status, created_at);

-- 6. Users & Records Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id);
