-- V17: Add Consultation Availability To Doctors
ALTER TABLE doctors ADD COLUMN available_in_clinic BOOLEAN DEFAULT TRUE;
ALTER TABLE doctors ADD COLUMN available_video BOOLEAN DEFAULT TRUE;
