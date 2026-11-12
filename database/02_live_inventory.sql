
-- Live inventory quantities
CREATE TABLE inventory (
    product_id INTEGER PRIMARY KEY
        REFERENCES products(product_id),

    available_qty INTEGER NOT NULL DEFAULT 0,
    reserved_qty INTEGER NOT NULL DEFAULT 0,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_available_qty
        CHECK (available_qty >= 0),

    CONSTRAINT check_reserved_qty
        CHECK (reserved_qty >= 0)
);

-- Live orders
CREATE TABLE orders (
    order_id BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(150),
    order_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_order_status
        CHECK (order_status IN (
            'PENDING',
            'CONFIRMED',
            'CANCELLED',
            'COMPLETED'
        ))
);

-- Products belonging to each order
CREATE TABLE order_items (
    order_item_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(order_id),
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,

    CONSTRAINT check_order_quantity
        CHECK (quantity > 0),

    CONSTRAINT check_order_price
        CHECK (unit_price >= 0)
);

-- Live stock reservations
CREATE TABLE reservations (
    reservation_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(order_id),
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    quantity INTEGER NOT NULL,
    reservation_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_reservation_quantity
        CHECK (quantity > 0),

    CONSTRAINT check_reservation_status
        CHECK (reservation_status IN (
            'ACTIVE',
            'CONFIRMED',
            'RELEASED',
            'EXPIRED'
        ))
);
