-- E3 Package Manager Database Schema (Updated Model)
-- Designed for PostgreSQL with mailbox-first approach, performance and auditability

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS signatures CASCADE;
DROP TABLE IF EXISTS packages CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS mailboxes CASCADE;

-- Create mailboxes table (primary anchor point)
CREATE TABLE mailboxes (
    id SERIAL PRIMARY KEY,
    mailbox_number VARCHAR(10) NOT NULL UNIQUE,
    default_tenant_id INTEGER, -- Will be set after tenants table is created
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tenants table (tied to mailboxes)
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    contact_info JSONB, -- Flexible contact information storage
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create packages table (mailbox-first approach)
-- SIMPLIFIED INTAKE MODEL: Only 3 required fields during intake
-- Required: mailbox_id, tenant_id, tracking_number
-- All other fields are OPTIONAL and can be added/updated later
CREATE TABLE packages (
    id SERIAL PRIMARY KEY,
    mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE, -- REQUIRED
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL, -- REQUIRED during intake, nullable for reassignment
    tracking_number VARCHAR(255) NOT NULL UNIQUE, -- REQUIRED
    status VARCHAR(50) NOT NULL DEFAULT 'received',
    high_value BOOLEAN DEFAULT FALSE, -- OPTIONAL - can be set later
    pickup_by VARCHAR(255), -- OPTIONAL - Person authorized to pick up (for high-value packages)
    carrier VARCHAR(100), -- OPTIONAL - can be null during intake, added later if needed
    size_category VARCHAR(20), -- OPTIONAL - can be null during intake, defaults handled in app
    notes TEXT, -- OPTIONAL
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('received', 'ready_for_pickup', 'picked_up', 'returned_to_sender')),
    CONSTRAINT valid_size CHECK (size_category IS NULL OR size_category IN ('small', 'medium', 'large', 'oversized'))
);

-- Create signatures table (simplified model)
CREATE TABLE signatures (
    id SERIAL PRIMARY KEY,
    package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    signature_data TEXT, -- Base64 encoded signature image
    blob_url VARCHAR(500), -- URL to stored signature image (cloud storage)
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for default_tenant_id after tenants table exists
ALTER TABLE mailboxes 
ADD CONSTRAINT fk_mailboxes_default_tenant 
FOREIGN KEY (default_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

-- Create indexes for performance
-- Mailbox lookups (critical for instant search)
CREATE INDEX idx_mailboxes_mailbox_number ON mailboxes(mailbox_number);
CREATE INDEX idx_mailboxes_active ON mailboxes(active) WHERE active = TRUE;
CREATE INDEX idx_mailboxes_default_tenant ON mailboxes(default_tenant_id) WHERE default_tenant_id IS NOT NULL;

-- Tenant lookups and relationships
CREATE INDEX idx_tenants_mailbox_id ON tenants(mailbox_id);
CREATE INDEX idx_tenants_name ON tenants(name);
CREATE INDEX idx_tenants_active ON tenants(active) WHERE active = TRUE;
CREATE INDEX idx_tenants_mailbox_active ON tenants(mailbox_id, active);

-- Package queries (mailbox-first, then tenant)
CREATE INDEX idx_packages_tracking_number ON packages(tracking_number);
CREATE INDEX idx_packages_mailbox_id ON packages(mailbox_id);
CREATE INDEX idx_packages_tenant_id ON packages(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_mailbox_status ON packages(mailbox_id, status);
CREATE INDEX idx_packages_received_at ON packages(received_at);
CREATE INDEX idx_packages_high_value ON packages(high_value) WHERE high_value = TRUE;

-- Signatures (linked to packages)
CREATE INDEX idx_signatures_package_id ON signatures(package_id);
CREATE INDEX idx_signatures_signed_at ON signatures(signed_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_mailboxes_updated_at 
    BEFORE UPDATE ON mailboxes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at 
    BEFORE UPDATE ON tenants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packages_updated_at 
    BEFORE UPDATE ON packages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample mailboxes
INSERT INTO mailboxes (mailbox_number, notes) VALUES
    ('101', 'Ground floor, left side'),
    ('102', 'Ground floor, left side'),
    ('103', 'Ground floor, center'),
    ('104', 'Ground floor, center'),
    ('105', 'Ground floor, right side'),
    ('145', 'Second floor, left side'),
    ('201', 'Second floor, center'),
    ('202', 'Second floor, center'),
    ('301', 'Third floor, left side'),
    ('350', 'Third floor, right side');

-- Insert sample tenants (tied to mailboxes)
INSERT INTO tenants (mailbox_id, name, phone, email, contact_info) VALUES
    (1, 'John Smith', '555-0101', 'john.smith@email.com', '{"preferred_contact": "email", "emergency_contact": "555-0199"}'),
    (2, 'Sarah Johnson', '555-0102', 'sarah.johnson@email.com', '{"preferred_contact": "phone"}'),
    (3, 'Michael Brown', '555-0103', 'michael.brown@email.com', '{"preferred_contact": "email"}'),
    (4, 'Emily Davis', '555-0104', 'emily.davis@email.com', '{"preferred_contact": "phone", "work_phone": "555-0404"}'),
    (5, 'David Wilson', '555-0105', 'david.wilson@email.com', '{"preferred_contact": "email"}'),
    (6, 'Alice Cooper', '555-0145', 'alice.cooper@email.com', '{"preferred_contact": "email", "assistant": "Bob Cooper"}'),
    (7, 'Bob Martinez', '555-0201', 'bob.martinez@email.com', '{"preferred_contact": "phone"}'),
    (8, 'Carol White', '555-0202', 'carol.white@email.com', '{"preferred_contact": "email"}'),
    (9, 'Robert Lee', '555-0301', 'robert.lee@email.com', '{"preferred_contact": "phone"}'),
    (10, 'Lisa Anderson', '555-0350', 'lisa.anderson@email.com', '{"preferred_contact": "email", "business_name": "Anderson Consulting"}');

-- Update mailboxes with default tenants (most common tenant for each mailbox)
UPDATE mailboxes SET default_tenant_id = 1 WHERE mailbox_number = '101';
UPDATE mailboxes SET default_tenant_id = 2 WHERE mailbox_number = '102';
UPDATE mailboxes SET default_tenant_id = 3 WHERE mailbox_number = '103';
UPDATE mailboxes SET default_tenant_id = 4 WHERE mailbox_number = '104';
UPDATE mailboxes SET default_tenant_id = 5 WHERE mailbox_number = '105';
UPDATE mailboxes SET default_tenant_id = 6 WHERE mailbox_number = '145';
UPDATE mailboxes SET default_tenant_id = 7 WHERE mailbox_number = '201';
UPDATE mailboxes SET default_tenant_id = 8 WHERE mailbox_number = '202';
UPDATE mailboxes SET default_tenant_id = 9 WHERE mailbox_number = '301';
UPDATE mailboxes SET default_tenant_id = 10 WHERE mailbox_number = '350';

-- Insert sample packages (mailbox-first approach)
INSERT INTO packages (mailbox_id, tenant_id, tracking_number, status, high_value, carrier, size_category) VALUES
    (1, 1, '1Z999AA1234567890', 'received', FALSE, 'UPS', 'small'),
    (2, 2, '9400111899562512345678', 'ready_for_pickup', FALSE, 'USPS', 'medium'),
    (3, 3, 'FDX123456789012', 'received', TRUE, 'FedEx', 'large'),
    (1, 1, 'AMZ987654321', 'picked_up', FALSE, 'Amazon', 'small'),
    (4, 4, 'DHL555666777888', 'received', FALSE, 'DHL', 'medium'),
    (6, 6, 'FEDX999888777666', 'received', TRUE, 'FedEx', 'large'),
    (7, 7, 'UPS111222333444', 'ready_for_pickup', FALSE, 'UPS', 'small'),
    (1, NULL, 'USPS444555666777', 'received', FALSE, 'USPS', 'medium'); -- Package with no specific tenant assigned

-- Performance validation queries (should all be fast)
-- Mailbox lookup by number (< 100ms) - PRIMARY WORKFLOW
-- EXPLAIN ANALYZE SELECT m.*, t.name as default_tenant_name FROM mailboxes m 
-- LEFT JOIN tenants t ON m.default_tenant_id = t.id 
-- WHERE m.mailbox_number = '145';

-- Package list for mailbox (< 300ms for 1000 packages) - MAILBOX-FIRST APPROACH
-- EXPLAIN ANALYZE SELECT p.*, t.name as tenant_name FROM packages p 
-- LEFT JOIN tenants t ON p.tenant_id = t.id 
-- WHERE p.mailbox_id = 1 AND p.status IN ('received', 'ready_for_pickup');

-- Package tracking lookup (< 200ms)
-- EXPLAIN ANALYZE SELECT p.*, m.mailbox_number, t.name as tenant_name FROM packages p 
-- JOIN mailboxes m ON p.mailbox_id = m.id 
-- LEFT JOIN tenants t ON p.tenant_id = t.id 
-- WHERE p.tracking_number = '1Z999AA1234567890';

-- Tenants for mailbox (for tenant switching)
-- EXPLAIN ANALYZE SELECT t.* FROM tenants t 
-- WHERE t.mailbox_id = 1 AND t.active = TRUE 
-- ORDER BY t.name;

-- All packages for pickup (mailbox view with tenant context)
-- EXPLAIN ANALYZE SELECT p.*, m.mailbox_number, t.name as tenant_name FROM packages p 
-- JOIN mailboxes m ON p.mailbox_id = m.id 
-- LEFT JOIN tenants t ON p.tenant_id = t.id 
-- WHERE p.status IN ('received', 'ready_for_pickup') 
-- ORDER BY m.mailbox_number, p.received_at;