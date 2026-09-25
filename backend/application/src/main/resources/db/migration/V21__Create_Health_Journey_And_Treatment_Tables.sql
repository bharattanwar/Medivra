-- V21__Create_Health_Journey_And_Treatment_Tables.sql

-- 1. Treatment Plans (Operational Core)
CREATE TABLE IF NOT EXISTS treatment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    doctor_id UUID,
    appointment_id UUID,
    medical_record_id UUID,
    title VARCHAR(255) NOT NULL,
    diagnosis TEXT,
    instructions TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    follow_up_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, DISCONTINUED, ESCALATED
    total_medications INT DEFAULT 0,
    total_tasks INT DEFAULT 0,
    completed_tasks INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON treatment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_doctor ON treatment_plans(doctor_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_status ON treatment_plans(status);

-- 2. Structured Treatment Medications
CREATE TABLE IF NOT EXISTS treatment_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    prescription_item_id UUID,
    medicine_name VARCHAR(255) NOT NULL,
    strength VARCHAR(100),
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    total_days INT DEFAULT 5,
    start_date DATE NOT NULL,
    end_date DATE,
    instructions TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, PAUSED, DISCONTINUED
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treatment_meds_plan ON treatment_medications(treatment_plan_id);

-- 3. Explicit Medication Dose Logs (Patient Confirmed Only)
CREATE TABLE IF NOT EXISTS medication_dose_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_medication_id UUID NOT NULL REFERENCES treatment_medications(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL,
    dose_date DATE NOT NULL,
    dose_slot VARCHAR(50) NOT NULL, -- MORNING, AFTERNOON, EVENING, NIGHT
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, TAKEN, SKIPPED, NOT_REPORTED
    confirmed_at TIMESTAMP,
    patient_note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dose_logs_patient_date ON medication_dose_logs(patient_id, dose_date);
CREATE INDEX IF NOT EXISTS idx_dose_logs_medication ON medication_dose_logs(treatment_medication_id);

-- 4. Treatment Lab Tests / Diagnostics Prescribed
CREATE TABLE IF NOT EXISTS treatment_lab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    urgency VARCHAR(50) DEFAULT 'ROUTINE', -- ROUTINE, URGENT, PRIORITY
    due_date DATE,
    instructions TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, ORDERED, COMPLETED, CANCELLED
    report_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treatment_lab_tests_patient ON treatment_lab_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_lab_tests_plan ON treatment_lab_tests(treatment_plan_id);

-- 5. Care Tasks (Actionable Next Steps Engine)
CREATE TABLE IF NOT EXISTS care_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
    task_type VARCHAR(50) NOT NULL, -- MEDICATION_DOSE, LAB_TEST, REPORT_UPLOAD, FOLLOW_UP_CONSULTATION, DAILY_CHECK_IN
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    due_time_slot VARCHAR(50) DEFAULT 'ANYTIME', -- MORNING, AFTERNOON, EVENING, NIGHT, ANYTIME
    priority VARCHAR(50) DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, SKIPPED, OVERDUE
    reference_id UUID,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_care_tasks_patient_date ON care_tasks(patient_id, due_date);
CREATE INDEX IF NOT EXISTS idx_care_tasks_status ON care_tasks(status);

-- 6. Structured Lab Report Parameters (Deterministic Comparison)
CREATE TABLE IF NOT EXISTS lab_report_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID,
    patient_id UUID NOT NULL,
    test_category VARCHAR(100),
    parameter_name VARCHAR(255) NOT NULL,
    numeric_value DOUBLE PRECISION,
    raw_value VARCHAR(100) NOT NULL,
    unit VARCHAR(50),
    reference_range_min DOUBLE PRECISION,
    reference_range_max DOUBLE PRECISION,
    reference_range_text VARCHAR(100),
    flag VARCHAR(50) DEFAULT 'NORMAL', -- NORMAL, HIGH, LOW, CRITICAL_HIGH, CRITICAL_LOW
    test_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lab_params_patient_param ON lab_report_parameters(patient_id, parameter_name);
CREATE INDEX IF NOT EXISTS idx_lab_params_report ON lab_report_parameters(report_id);
