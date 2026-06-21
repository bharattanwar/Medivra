-- V13: Add payment_method column to medicine_orders table
ALTER TABLE medicine_orders
    ADD COLUMN payment_method VARCHAR(50) DEFAULT 'online';
