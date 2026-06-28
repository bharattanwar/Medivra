-- V14: Add razorpay_order_id and payment_status to medicine_orders
ALTER TABLE medicine_orders ADD COLUMN razorpay_order_id VARCHAR(255);
ALTER TABLE medicine_orders ADD COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING';

-- Migrate existing data
UPDATE medicine_orders SET payment_status = 'PAID' WHERE status IN ('PAID', 'DELIVERED', 'PROCESSING') AND (payment_method = 'online' OR payment_method IS NULL);
UPDATE medicine_orders SET payment_status = 'TO_BE_PAID' WHERE payment_method = 'cod';
UPDATE medicine_orders SET payment_status = 'PAID' WHERE payment_method = 'cod' AND status = 'DELIVERED';
