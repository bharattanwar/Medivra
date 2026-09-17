-- V20__Optimize_Indexes_And_Performance.sql
-- Database index optimization for high performance query execution and latency reduction

-- 1. Pharmacy Inventories & Medicines Indexes
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventories_pharmacy_med ON pharmacy_inventories(pharmacy_id, medicine_id);
CREATE INDEX IF NOT EXISTS idx_medicines_name_lower ON medicines(LOWER(name));

-- 2. Pharmacy Status Index
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_active ON pharmacies(is_active);

-- 3. Appointments & Payments Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_payments_status_method ON payments(payment_status, method);

-- 4. Medicine Orders Indexes
CREATE INDEX IF NOT EXISTS idx_medicine_orders_status ON medicine_orders(status);

-- 5. Emergency Requests Index
CREATE INDEX IF NOT EXISTS idx_emergency_requests_status_created ON emergency_requests(status, created_at);

-- 6. Medical Records Indexes
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id);
