-- Make doctor and appointment optional for external uploads
ALTER TABLE medical_records ALTER COLUMN appointment_id DROP NOT NULL;
ALTER TABLE medical_records ALTER COLUMN doctor_id DROP NOT NULL;

-- Prescription Items (identified medicines)
CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_record_id UUID NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255) NOT NULL,
    strength VARCHAR(100),
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Medicine Orders
CREATE TABLE medicine_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES medical_records(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    total_amount DECIMAL(10, 2) NOT NULL,
    user_latitude DOUBLE PRECISION NOT NULL,
    user_longitude DOUBLE PRECISION NOT NULL,
    delivery_address TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Medicine Order Items
CREATE TABLE medicine_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES medicine_orders(id) ON DELETE CASCADE,
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    delivery_estimate VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Refill Reminders
CREATE TABLE refill_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255) NOT NULL,
    next_refill_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescription_items_record ON prescription_items(medical_record_id);
CREATE INDEX idx_med_orders_patient ON medicine_orders(patient_id);
CREATE INDEX idx_med_order_items_order ON medicine_order_items(order_id);
CREATE INDEX idx_med_order_items_pharmacy ON medicine_order_items(pharmacy_id);
