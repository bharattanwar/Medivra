-- V15: Create Emergency SOS Tables

-- Ambulance drivers (linked to users table)
CREATE TABLE ambulance_drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    license_number VARCHAR(100) NOT NULL UNIQUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    profile_image_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Ambulances fleet
CREATE TABLE ambulances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_number VARCHAR(100) NOT NULL UNIQUE,
    ambulance_type VARCHAR(50) NOT NULL DEFAULT 'BASIC',
    driver_id UUID REFERENCES ambulance_drivers(id) ON DELETE SET NULL,
    registered_hospital_id UUID,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    last_location_update TIMESTAMP,
    equipment_notes TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Emergency requests (core SOS entity)
CREATE TABLE emergency_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id),
    patient_lat DOUBLE PRECISION NOT NULL,
    patient_lng DOUBLE PRECISION NOT NULL,
    patient_address TEXT,
    emergency_type VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    assigned_ambulance_id UUID REFERENCES ambulances(id),
    assigned_hospital_id UUID,
    search_radius_km DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    estimated_arrival_minutes INTEGER,
    escalation_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Emergency contacts registered by patients
CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    relationship VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Complete audit trail of all emergency events
CREATE TABLE emergency_timelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    emergency_id UUID NOT NULL REFERENCES emergency_requests(id) ON DELETE CASCADE,
    event VARCHAR(100) NOT NULL,
    description TEXT,
    event_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_emergency_requests_patient ON emergency_requests(patient_id);
CREATE INDEX idx_emergency_requests_status ON emergency_requests(status);
CREATE INDEX idx_ambulances_online_available ON ambulances(is_online, is_available);
CREATE INDEX idx_ambulances_location ON ambulances(current_lat, current_lng);
CREATE INDEX idx_emergency_contacts_patient ON emergency_contacts(patient_id);
CREATE INDEX idx_emergency_timelines_emergency ON emergency_timelines(emergency_id);
CREATE INDEX idx_ambulance_drivers_user ON ambulance_drivers(user_id);
