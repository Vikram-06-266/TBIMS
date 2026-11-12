CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    stock_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_unit_price
    CHECK (unit_price >= 0)
);