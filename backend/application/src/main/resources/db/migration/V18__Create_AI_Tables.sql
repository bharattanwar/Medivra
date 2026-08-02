-- Create AI Tables

CREATE TABLE IF NOT EXISTS medical_reports (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    patient_id UUID NOT NULL,
    report_type VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255),
    CONSTRAINT fk_medical_report_patient FOREIGN KEY (patient_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ai_report_summaries (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    report_id UUID NOT NULL UNIQUE,
    summary_text TEXT NOT NULL,
    abnormal_findings TEXT,
    normal_findings TEXT,
    suggested_questions TEXT,
    recommended_follow_ups TEXT,
    confidence_level VARCHAR(50),
    raw_ai_response TEXT,
    CONSTRAINT fk_ai_report_summary_report FOREIGN KEY (report_id) REFERENCES medical_reports(id)
);

CREATE TABLE IF NOT EXISTS doctor_recommendations (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    patient_id UUID NOT NULL,
    symptoms TEXT NOT NULL,
    preferences TEXT,
    recommended_specialty VARCHAR(255) NOT NULL,
    urgency_level VARCHAR(50) NOT NULL,
    ranked_doctors TEXT NOT NULL,
    ai_explanation TEXT,
    CONSTRAINT fk_doctor_recommendation_patient FOREIGN KEY (patient_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS follow_up_plans (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    appointment_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    diagnosis TEXT,
    medicines TEXT,
    follow_up_interval_days INTEGER,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL,
    CONSTRAINT fk_follow_up_plan_patient FOREIGN KEY (patient_id) REFERENCES users(id),
    CONSTRAINT fk_follow_up_plan_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    CONSTRAINT fk_follow_up_plan_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

CREATE TABLE IF NOT EXISTS follow_up_check_ins (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    follow_up_plan_id UUID NOT NULL,
    day_number INTEGER NOT NULL,
    responses TEXT NOT NULL,
    ai_analysis TEXT,
    action_recommended VARCHAR(50),
    CONSTRAINT fk_follow_up_check_in_plan FOREIGN KEY (follow_up_plan_id) REFERENCES follow_up_plans(id)
);

CREATE TABLE IF NOT EXISTS ai_interactions (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    user_id UUID,
    interaction_type VARCHAR(100) NOT NULL,
    request_summary TEXT,
    response_text TEXT,
    model_used VARCHAR(100),
    tokens_used INTEGER,
    latency_ms BIGINT
);
