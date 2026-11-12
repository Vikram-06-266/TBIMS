
-- Historical customers
CREATE TABLE historical_customers (
    customer_id VARCHAR(20) PRIMARY KEY,
    country VARCHAR(100)
);

-- Historical invoices
CREATE TABLE historical_invoices (
    invoice_no VARCHAR(20) PRIMARY KEY,
    invoice_date TIMESTAMP NOT NULL,
    customer_id VARCHAR(20),
    country VARCHAR(100),

    FOREIGN KEY (customer_id)
        REFERENCES historical_customers(customer_id)
);

-- Historical products
CREATE TABLE historical_products (
    stock_code VARCHAR(50) PRIMARY KEY,
    description TEXT
);

-- Historical invoice line items
CREATE TABLE historical_invoice_items (
    historical_item_id BIGSERIAL PRIMARY KEY,
    invoice_no VARCHAR(20) NOT NULL,
    stock_code VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,

    FOREIGN KEY (invoice_no)
        REFERENCES historical_invoices(invoice_no),

    FOREIGN KEY (stock_code)
        REFERENCES historical_products(stock_code)
);

-- Indexes for searching and reporting
CREATE INDEX idx_hist_invoice_date
ON historical_invoices(invoice_date);

CREATE INDEX idx_hist_invoice_customer
ON historical_invoices(customer_id);

CREATE INDEX idx_hist_item_stock
ON historical_invoice_items(stock_code);
psql -U postgres -d inventory_db -f database/01_historical_tables.sql