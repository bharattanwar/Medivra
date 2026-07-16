-- V16: Add Consultation Type to Appointments
ALTER TABLE appointments ADD COLUMN consultation_type VARCHAR(50) NOT NULL DEFAULT 'ONLINE';
