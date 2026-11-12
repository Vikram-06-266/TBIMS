
-- Prevent modification of existing ledger records
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'Stock ledger records cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

-- Block UPDATE operations
CREATE TRIGGER no_ledger_update
BEFORE UPDATE ON stock_ledger
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_modification();

-- Block DELETE operations
CREATE TRIGGER no_ledger_delete
BEFORE DELETE ON stock_ledger
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_modification();

