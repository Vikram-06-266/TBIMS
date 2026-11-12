
-- Users who perform live inventory operations
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_user_role
        CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF'))
);

-- Live stock-changing transactions
CREATE TABLE stock_transactions (
    transaction_id BIGSERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    user_id BIGINT REFERENCES users(user_id),
    transaction_type VARCHAR(30) NOT NULL,
    quantity INTEGER NOT NULL,
    reference_id VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_transaction_type
        CHECK (transaction_type IN (
            'OPENING',
            'SALE',
            'PURCHASE',
            'RETURN',
            'CANCELLATION',
            'DAMAGE',
            'ADJUSTMENT'
        )),

    CONSTRAINT check_transaction_quantity
        CHECK (quantity > 0)
);

-- Append-only stock movement ledger
CREATE TABLE stock_ledger (
    ledger_id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL
        REFERENCES stock_transactions(transaction_id),
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    quantity_change INTEGER NOT NULL,
    available_after INTEGER NOT NULL,
    reserved_after INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_ledger_available
        CHECK (available_after >= 0),

    CONSTRAINT check_ledger_reserved
        CHECK (reserved_after >= 0)
);

-- Audit history
CREATE TABLE audit_logs (
    audit_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Useful indexes
CREATE INDEX idx_transactions_product
ON stock_transactions(product_id);

CREATE INDEX idx_transactions_date
ON stock_transactions(created_at);

CREATE INDEX idx_ledger_product
ON stock_ledger(product_id);
