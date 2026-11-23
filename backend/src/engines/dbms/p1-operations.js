import pool from "./pool.js";

function mapDbError(error) {
  if (error?.code === "23505") {
    const err = new Error("A record with this unique identifier already exists.");
    err.code = "DUPLICATE_KEY";
    return err;
  }
  if (error?.code === "23514" || error?.code === "23502") {
    const err = new Error("The operation violated database constraints.");
    err.code = "CONSTRAINT_VIOLATION";
    return err;
  }
  if (error?.code === "23503") {
    const err = new Error("Foreign key constraint violation: referenced entity does not exist.");
    err.code = "FOREIGN_KEY_VIOLATION";
    return err;
  }
  if (error?.code === "40P01") {
    const err = new Error("Transaction deadlock detected. Operation was rolled back.");
    err.code = "DEADLOCK_DETECTED";
    return err;
  }
  if (error?.code === "DATABASE_UNAVAILABLE" || error?.code === "ECONNREFUSED" || error?.code?.startsWith("08")) {
    const err = new Error("PostgreSQL database is currently unavailable.");
    err.code = "DATABASE_UNAVAILABLE";
    return err;
  }
  return error;
}

async function resolveDbUserId(client, userId) {
  const n = Number(userId);
  if (!Number.isInteger(n) || n <= 0) return null;
  try {
    const res = await client.query("SELECT user_id FROM users WHERE user_id = $1;", [n]);
    return res.rows.length > 0 ? n : null;
  } catch {
    return null;
  }
}

export function createP1Operations(databasePool = pool) {
  return {
    async checkHealth() {
      try {
        const result = await databasePool.query(
          "SELECT current_database() AS database, NOW() AS server_time, version() AS version;"
        );
        return {
          ok: true,
          database: result.rows[0].database,
          serverTime: result.rows[0].server_time,
          version: result.rows[0].version,
        };
      } catch (error) {
        return {
          ok: false,
          code: error?.code || "DATABASE_ERROR",
          message: error?.message || "Failed to connect to PostgreSQL.",
        };
      }
    },

    async inspectDatabase() {
      try {
        // Query public tables
        const tablesRes = await databasePool.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `);
        const tables = tablesRes.rows.map((r) => r.table_name);

        const counts = {};
        for (const tbl of tables) {
          try {
            // Safe parameterized table count using regclass
            const countRes = await databasePool.query(
              `SELECT count(*)::int AS count FROM ${tbl};`
            );
            counts[tbl] = countRes.rows[0].count;
          } catch {
            counts[tbl] = -1;
          }
        }

        return { ok: true, tables, counts };
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async listProducts() {
      try {
        const result = await databasePool.query(`
          SELECT
            p.product_id AS id,
            p.stock_code AS sku,
            p.description AS name,
            p.unit_price::text AS unit_price,
            COALESCE(i.available_qty + i.reserved_qty, 0) AS on_hand,
            COALESCE(i.reserved_qty, 0) AS reserved,
            COALESCE(i.available_qty, 0) AS available,
            p.created_at
          FROM products p
          LEFT JOIN inventory i ON p.product_id = i.product_id
          ORDER BY p.product_id;
        `);
        return result.rows;
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async createProduct({ sku, name, unit_price }) {
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN;");

        const insertProductRes = await client.query(`
          INSERT INTO products (stock_code, description, unit_price)
          VALUES ($1, $2, $3)
          RETURNING product_id AS id, stock_code AS sku, description AS name, unit_price::text AS unit_price, created_at;
        `, [sku, name, unit_price]);

        const newProd = insertProductRes.rows[0];

        // Companion inventory row
        await client.query(`
          INSERT INTO inventory (product_id, available_qty, reserved_qty)
          VALUES ($1, 0, 0);
        `, [newProd.id]);

        await client.query("COMMIT;");

        return {
          ...newProd,
          on_hand: 0,
          reserved: 0,
          available: 0,
        };
      } catch (error) {
        await client.query("ROLLBACK;");
        throw mapDbError(error);
      } finally {
        client.release();
      }
    },

    async receiveStock({ productId, sku, productSku, quantity, referenceId = "", description = "", userId = null, performedBy = null }) {
      const qty = parseInt(quantity, 10);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error("Received quantity must be a positive integer.");
      }

      const client = await databasePool.connect();
      try {
        await client.query("BEGIN;");

        const verifiedUserId = await resolveDbUserId(client, userId);

        // Resolve product_id if sku provided
        let targetId = productId;
        let targetName = "";
        let targetSku = sku || productSku;
        if (!targetId && targetSku) {
          const pRes = await client.query("SELECT product_id, stock_code, description FROM products WHERE stock_code = $1", [targetSku]);
          if (pRes.rows.length === 0) throw new Error(`Product with SKU ${targetSku} not found.`);
          targetId = pRes.rows[0].product_id;
          targetName = pRes.rows[0].description;
          targetSku = pRes.rows[0].stock_code;
        } else {
          const pRes = await client.query("SELECT product_id, stock_code, description FROM products WHERE product_id = $1", [targetId]);
          if (pRes.rows.length === 0) throw new Error(`Product with ID ${targetId} not found.`);
          targetName = pRes.rows[0].description;
          targetSku = pRes.rows[0].stock_code;
        }

        // Lock inventory row
        const invRes = await client.query(
          "SELECT available_qty, reserved_qty FROM inventory WHERE product_id = $1 FOR UPDATE;",
          [targetId]
        );

        let newAvailable = qty;
        let newReserved = 0;

        if (invRes.rows.length === 0) {
          // Initialize inventory if companion missing
          await client.query(
            "INSERT INTO inventory (product_id, available_qty, reserved_qty) VALUES ($1, $2, 0);",
            [targetId, qty]
          );
        } else {
          const currentInv = invRes.rows[0];
          newAvailable = currentInv.available_qty + qty;
          newReserved = currentInv.reserved_qty;

          await client.query(
            "UPDATE inventory SET available_qty = $1, updated_at = NOW() WHERE product_id = $2;",
            [newAvailable, targetId]
          );
        }

        // Insert stock_transactions
        const txRes = await client.query(`
          INSERT INTO stock_transactions (product_id, user_id, transaction_type, quantity, reference_id, description)
          VALUES ($1, $2, 'PURCHASE', $3, $4, $5)
          RETURNING transaction_id;
        `, [targetId, verifiedUserId, qty, referenceId, description || "Stock intake received"]);

        const txId = txRes.rows[0].transaction_id;

        // Insert stock_ledger (append-only)
        await client.query(`
          INSERT INTO stock_ledger (transaction_id, product_id, quantity_change, available_after, reserved_after)
          VALUES ($1, $2, $3, $4, $5);
        `, [txId, targetId, qty, newAvailable, newReserved]);

        // Insert audit_logs
        await client.query(`
          INSERT INTO audit_logs (user_id, action, details)
          VALUES ($1, 'STOCK_RECEIVED', $2);
        `, [verifiedUserId, `Received ${qty} units of "${targetName}" (${targetSku})${performedBy ? ` (by ${performedBy})` : ''}. Reference: ${referenceId || 'N/A'}`]);

        await client.query("COMMIT;");

        return {
          id: targetId,
          sku: targetSku,
          name: targetName,
          on_hand: newAvailable + newReserved,
          reserved: newReserved,
          available: newAvailable,
        };
      } catch (error) {
        await client.query("ROLLBACK;");
        throw mapDbError(error);
      } finally {
        client.release();
      }
    },

    async reserveOrder({ customerName, items, userId = null, performedBy = null }) {
      if (!customerName || !customerName.trim()) {
        throw new Error("Customer name is required.");
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("At least one order item is required.");
      }

      const client = await databasePool.connect();
      try {
        await client.query("BEGIN;");

        const verifiedUserId = await resolveDbUserId(client, userId);

        // 1. Create order
        const orderRes = await client.query(`
          INSERT INTO orders (customer_name, order_status)
          VALUES ($1, 'PENDING')
          RETURNING order_id, customer_name, order_status, created_at;
        `, [customerName.trim()]);
        const order = orderRes.rows[0];

        // 2. Resolve all items first
        const resolvedItems = [];
        for (const item of items) {
          const qty = parseInt(item.quantity, 10);
          if (!Number.isInteger(qty) || qty <= 0) {
            throw new Error(`Quantity for item must be a positive integer.`);
          }

          const pRes = await client.query(
            "SELECT product_id, stock_code, description, unit_price FROM products WHERE product_id = $1 OR stock_code = $2;",
            [item.productId || null, item.productSku || ""]
          );
          if (pRes.rows.length === 0) {
            throw new Error(`Product not found.`);
          }
          resolvedItems.push({ ...pRes.rows[0], requestedQty: qty });
        }

        // Sort items deterministically by product_id ASC to eliminate deadlocks on concurrent orders
        resolvedItems.sort((a, b) => a.product_id - b.product_id);

        let totalAmount = 0;

        for (const prod of resolvedItems) {
          const qty = prod.requestedQty;

          // Lock inventory row in deterministic order
          const invRes = await client.query(
            "SELECT available_qty, reserved_qty FROM inventory WHERE product_id = $1 FOR UPDATE;",
            [prod.product_id]
          );
          if (invRes.rows.length === 0 || invRes.rows[0].available_qty < qty) {
            const avail = invRes.rows[0]?.available_qty || 0;
            throw new Error(`Insufficient available stock for "${prod.description}" (${prod.stock_code}). Requested: ${qty}, Available: ${avail}.`);
          }

          const currentInv = invRes.rows[0];
          const nextAvail = currentInv.available_qty - qty;
          const nextReserved = currentInv.reserved_qty + qty;

          // Reserve stock
          await client.query(
            "UPDATE inventory SET available_qty = $1, reserved_qty = $2, updated_at = NOW() WHERE product_id = $3;",
            [nextAvail, nextReserved, prod.product_id]
          );

          // Insert order_items
          await client.query(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price)
            VALUES ($1, $2, $3, $4);
          `, [order.order_id, prod.product_id, qty, prod.unit_price]);

          // Insert reservations
          await client.query(`
            INSERT INTO reservations (order_id, product_id, quantity, reservation_status)
            VALUES ($1, $2, $3, 'ACTIVE');
          `, [order.order_id, prod.product_id, qty]);

          totalAmount += Number(prod.unit_price) * qty;
        }

        // Insert audit_logs
        await client.query(`
          INSERT INTO audit_logs (user_id, action, details)
          VALUES ($1, 'ORDER_CREATED', $2);
        `, [verifiedUserId, `Created order ORD-2026-${order.order_id} for ${customerName.trim()}${performedBy ? ` (by ${performedBy})` : ''} with ${items.length} line item(s).`]);

        await client.query("COMMIT;");

        return {
          id: order.order_id,
          orderNumber: `ORD-2026-${String(order.order_id).padStart(3, '0')}`,
          customerName: order.customer_name,
          status: order.order_status,
          totalAmount: totalAmount.toFixed(2),
          createdAt: order.created_at,
        };
      } catch (error) {
        await client.query("ROLLBACK;");
        throw mapDbError(error);
      } finally {
        client.release();
      }
    },

    async confirmOrder({ orderId, userId = null, performedBy = null }) {
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN;");

        const verifiedUserId = await resolveDbUserId(client, userId);

        const orderRes = await client.query(
          "SELECT order_id, customer_name, order_status FROM orders WHERE order_id = $1 FOR UPDATE;",
          [orderId]
        );
        if (orderRes.rows.length === 0) throw new Error(`Order ${orderId} not found.`);
        const order = orderRes.rows[0];

        if (order.order_status !== 'PENDING') {
          throw new Error(`Order cannot be confirmed because it is already "${order.order_status}".`);
        }

        // Update order status
        await client.query("UPDATE orders SET order_status = 'CONFIRMED' WHERE order_id = $1;", [orderId]);

        // Update reservations
        await client.query("UPDATE reservations SET reservation_status = 'CONFIRMED' WHERE order_id = $1;", [orderId]);

        // Get items in deterministic order
        const itemsRes = await client.query(`
          SELECT oi.product_id, oi.quantity, p.stock_code, p.description
          FROM order_items oi
          JOIN products p ON oi.product_id = p.product_id
          WHERE oi.order_id = $1
          ORDER BY oi.product_id ASC;
        `, [orderId]);

        for (const item of itemsRes.rows) {
          // Lock inventory
          const invRes = await client.query(
            "SELECT available_qty, reserved_qty FROM inventory WHERE product_id = $1 FOR UPDATE;",
            [item.product_id]
          );
          const currentInv = invRes.rows[0];
          const newReserved = Math.max(0, currentInv.reserved_qty - item.quantity);

          await client.query(
            "UPDATE inventory SET reserved_qty = $1, updated_at = NOW() WHERE product_id = $2;",
            [newReserved, item.product_id]
          );

          // Stock transaction
          const txRes = await client.query(`
            INSERT INTO stock_transactions (product_id, user_id, transaction_type, quantity, reference_id, description)
            VALUES ($1, $2, 'SALE', $3, $4, 'Order confirmed and fulfilled')
            RETURNING transaction_id;
          `, [item.product_id, verifiedUserId, item.quantity, `ORD-${orderId}`]);

          // Stock ledger
          await client.query(`
            INSERT INTO stock_ledger (transaction_id, product_id, quantity_change, available_after, reserved_after)
            VALUES ($1, $2, $3, $4, $5);
          `, [txRes.rows[0].transaction_id, item.product_id, -item.quantity, currentInv.available_qty, newReserved]);
        }

        await client.query(`
          INSERT INTO audit_logs (user_id, action, details)
          VALUES ($1, 'ORDER_CONFIRMED', $2);
        `, [verifiedUserId, `Confirmed order ORD-2026-${orderId} for ${order.customer_name}${performedBy ? ` (by ${performedBy})` : ''}. Stock deducted.`]);

        await client.query("COMMIT;");

        return {
          id: orderId,
          orderNumber: `ORD-2026-${String(orderId).padStart(3, '0')}`,
          status: 'CONFIRMED',
        };
      } catch (error) {
        await client.query("ROLLBACK;");
        throw mapDbError(error);
      } finally {
        client.release();
      }
    },

    async cancelOrder({ orderId, userId = null, performedBy = null }) {
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN;");

        const verifiedUserId = await resolveDbUserId(client, userId);

        const orderRes = await client.query(
          "SELECT order_id, customer_name, order_status FROM orders WHERE order_id = $1 FOR UPDATE;",
          [orderId]
        );
        if (orderRes.rows.length === 0) throw new Error(`Order ${orderId} not found.`);
        const order = orderRes.rows[0];

        if (order.order_status !== 'PENDING') {
          throw new Error(`Order cannot be cancelled because it is already "${order.order_status}".`);
        }

        // Update order status
        await client.query("UPDATE orders SET order_status = 'CANCELLED' WHERE order_id = $1;", [orderId]);

        // Update reservations
        await client.query("UPDATE reservations SET reservation_status = 'RELEASED' WHERE order_id = $1;", [orderId]);

        // Get items to release in deterministic order
        const itemsRes = await client.query(`
          SELECT oi.product_id, oi.quantity, p.stock_code, p.description
          FROM order_items oi
          JOIN products p ON oi.product_id = p.product_id
          WHERE oi.order_id = $1
          ORDER BY oi.product_id ASC;
        `, [orderId]);

        for (const item of itemsRes.rows) {
          const invRes = await client.query(
            "SELECT available_qty, reserved_qty FROM inventory WHERE product_id = $1 FOR UPDATE;",
            [item.product_id]
          );
          const currentInv = invRes.rows[0];
          const newReserved = Math.max(0, currentInv.reserved_qty - item.quantity);
          const newAvailable = currentInv.available_qty + item.quantity;

          await client.query(
            "UPDATE inventory SET available_qty = $1, reserved_qty = $2, updated_at = NOW() WHERE product_id = $3;",
            [newAvailable, newReserved, item.product_id]
          );

          const txRes = await client.query(`
            INSERT INTO stock_transactions (product_id, user_id, transaction_type, quantity, reference_id, description)
            VALUES ($1, $2, 'CANCELLATION', $3, $4, 'Order cancelled, reserved units released')
            RETURNING transaction_id;
          `, [item.product_id, verifiedUserId, item.quantity, `ORD-${orderId}`]);

          // Insert into stock_ledger with quantity_change = 0 (physical stock unchanged, reservation released)
          await client.query(`
            INSERT INTO stock_ledger (transaction_id, product_id, quantity_change, available_after, reserved_after)
            VALUES ($1, $2, 0, $3, $4);
          `, [txRes.rows[0].transaction_id, item.product_id, newAvailable, newReserved]);
        }

        await client.query(`
          INSERT INTO audit_logs (user_id, action, details)
          VALUES ($1, 'ORDER_CANCELLED', $2);
        `, [verifiedUserId, `Cancelled order ORD-2026-${orderId}${performedBy ? ` (by ${performedBy})` : ''}. Released reserved inventory.`]);

        await client.query("COMMIT;");

        return {
          id: orderId,
          orderNumber: `ORD-2026-${String(orderId).padStart(3, '0')}`,
          status: 'CANCELLED',
        };
      } catch (error) {
        await client.query("ROLLBACK;");
        throw mapDbError(error);
      } finally {
        client.release();
      }
    },

    async processReturn({ orderId, productId, sku, productSku, quantity, reason = "Customer return", userId = null, performedBy = null }) {
      const qty = parseInt(quantity, 10);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error("Return quantity must be a positive integer.");

      const client = await databasePool.connect();
      try {
        await client.query("BEGIN;");

        const verifiedUserId = await resolveDbUserId(client, userId);

        // Lock order row to prevent concurrent race conditions
        const orderRes = await client.query(
          "SELECT order_id, order_status FROM orders WHERE order_id = $1 FOR UPDATE;",
          [orderId]
        );
        if (orderRes.rows.length === 0) throw new Error(`Order ${orderId} not found.`);
        if (orderRes.rows[0].order_status !== 'CONFIRMED' && orderRes.rows[0].order_status !== 'COMPLETED') {
          throw new Error(`Returns can only be processed on CONFIRMED or COMPLETED orders.`);
        }

        let targetProductId = productId;
        const targetSku = sku || productSku;
        if (!targetProductId && targetSku) {
          const pRes = await client.query("SELECT product_id FROM products WHERE stock_code = $1;", [targetSku]);
          if (pRes.rows.length > 0) targetProductId = pRes.rows[0].product_id;
        }

        const itemRes = await client.query(
          "SELECT quantity FROM order_items WHERE order_id = $1 AND product_id = $2;",
          [orderId, targetProductId]
        );
        if (itemRes.rows.length === 0) throw new Error(`Product ${targetProductId || targetSku} is not part of order ${orderId}.`);

        // Check already-returned quantity to prevent duplicate returns or over-returns
        const prevReturnsRes = await client.query(
          "SELECT COALESCE(SUM(quantity), 0)::int AS already_returned FROM stock_transactions WHERE reference_id = $1 AND product_id = $2 AND transaction_type = 'RETURN';",
          [`ORD-${orderId}`, targetProductId]
        );
        const alreadyReturned = prevReturnsRes.rows[0]?.already_returned || 0;
        const remainingReturnable = itemRes.rows[0].quantity - alreadyReturned;

        if (qty > remainingReturnable) {
          throw new Error(`Return quantity (${qty}) exceeds remaining returnable quantity (${remainingReturnable}). Already returned: ${alreadyReturned}.`);
        }

        // Lock inventory and restore available stock
        const invRes = await client.query(
          "SELECT available_qty, reserved_qty FROM inventory WHERE product_id = $1 FOR UPDATE;",
          [targetProductId]
        );
        const currentInv = invRes.rows[0];
        const newAvailable = currentInv.available_qty + qty;

        await client.query(
          "UPDATE inventory SET available_qty = $1, updated_at = NOW() WHERE product_id = $2;",
          [newAvailable, targetProductId]
        );

        // Record RETURN transaction
        const txRes = await client.query(`
          INSERT INTO stock_transactions (product_id, user_id, transaction_type, quantity, reference_id, description)
          VALUES ($1, $2, 'RETURN', $3, $4, $5)
          RETURNING transaction_id;
        `, [targetProductId, verifiedUserId, qty, `ORD-${orderId}`, reason || "Return processed"]);

        // Record stock_ledger
        await client.query(`
          INSERT INTO stock_ledger (transaction_id, product_id, quantity_change, available_after, reserved_after)
          VALUES ($1, $2, $3, $4, $5);
        `, [txRes.rows[0].transaction_id, targetProductId, qty, newAvailable, currentInv.reserved_qty]);

        // Audit log
        await client.query(`
          INSERT INTO audit_logs (user_id, action, details)
          VALUES ($1, 'RETURN_PROCESSED', $2);
        `, [verifiedUserId, `Processed return of ${qty} units for order ORD-2026-${orderId}${performedBy ? ` (by ${performedBy})` : ''}. Reason: ${reason}`]);

        await client.query("COMMIT;");

        const prodRes = await client.query(
          "SELECT product_id, stock_code, description FROM products WHERE product_id = $1;",
          [targetProductId]
        );
        const prod = prodRes.rows[0];

        return {
          productId: targetProductId,
          sku: prod?.stock_code || "",
          name: prod?.description || "",
          on_hand: newAvailable + currentInv.reserved_qty,
          reserved: currentInv.reserved_qty,
          available: newAvailable,
          returnedQuantity: qty,
          availableAfter: newAvailable,
        };
      } catch (error) {
        await client.query("ROLLBACK;");
        throw mapDbError(error);
      } finally {
        client.release();
      }
    },

    async updateProduct({ id, sku, name, unit_price }) {
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN;");
        const res = await client.query(`
          UPDATE products
          SET description = COALESCE($1, description),
              unit_price = COALESCE($2, unit_price)
          WHERE product_id = $3 OR stock_code = $4
          RETURNING product_id AS id, stock_code AS sku, description AS name, unit_price::text AS unit_price, created_at;
        `, [name || null, unit_price || null, id || null, sku || null]);
        if (res.rows.length === 0) {
          throw new Error("Product not found.");
        }
        await client.query("COMMIT;");
        return res.rows[0];
      } catch (error) {
        await client.query("ROLLBACK;");
        throw mapDbError(error);
      } finally {
        client.release();
      }
    },

    async listOrders({ customerName } = {}) {
      try {
        const result = await databasePool.query(`
          SELECT
            o.order_id AS id,
            'ORD-2026-' || LPAD(o.order_id::text, 3, '0') AS "orderNumber",
            o.customer_name AS "customerName",
            o.order_status AS status,
            o.created_at AS "createdAt",
            COALESCE(SUM(oi.quantity * oi.unit_price), 0)::text AS "totalAmount",
            COALESCE(
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'orderItemId', oi.order_item_id,
                  'productId', oi.product_id,
                  'productSku', p.stock_code,
                  'productName', p.description,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price::text
                )
              ) FILTER (WHERE oi.order_item_id IS NOT NULL),
              '[]'::json
            ) AS items
          FROM orders o
          LEFT JOIN order_items oi ON o.order_id = oi.order_id
          LEFT JOIN products p ON oi.product_id = p.product_id
          WHERE ($1::text IS NULL OR o.customer_name = $1)
          GROUP BY o.order_id, o.customer_name, o.order_status, o.created_at
          ORDER BY o.order_id DESC;
        `, [customerName || null]);
        return result.rows;
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async getOrderById(orderId) {
      try {
        const id = Number(orderId);
        if (!Number.isInteger(id)) return null;
        const result = await databasePool.query(`
          SELECT
            o.order_id AS id,
            'ORD-2026-' || LPAD(o.order_id::text, 3, '0') AS "orderNumber",
            o.customer_name AS "customerName",
            o.order_status AS status,
            o.created_at AS "createdAt",
            COALESCE(SUM(oi.quantity * oi.unit_price), 0)::text AS "totalAmount",
            COALESCE(
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'orderItemId', oi.order_item_id,
                  'productId', oi.product_id,
                  'productSku', p.stock_code,
                  'productName', p.description,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price::text
                )
              ) FILTER (WHERE oi.order_item_id IS NOT NULL),
              '[]'::json
            ) AS items
          FROM orders o
          LEFT JOIN order_items oi ON o.order_id = oi.order_id
          LEFT JOIN products p ON oi.product_id = p.product_id
          WHERE o.order_id = $1
          GROUP BY o.order_id, o.customer_name, o.order_status, o.created_at;
        `, [id]);
        return result.rows[0] || null;
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async listCustomerProducts({ query = "", limit = 100, offset = 0 } = {}) {
      try {
        const searchPattern = query && query.trim() ? `%${query.trim()}%` : null;
        const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
        const safeOffset = Math.max(0, Number(offset) || 0);

        const result = await databasePool.query(`
          SELECT
            p.product_id AS id,
            p.stock_code AS sku,
            p.description AS name,
            p.unit_price::text AS unit_price,
            COALESCE(i.available_qty, 0) AS available,
            (COALESCE(i.available_qty, 0) > 0) AS in_stock
          FROM products p
          LEFT JOIN inventory i ON p.product_id = i.product_id
          WHERE ($1::text IS NULL OR p.stock_code ILIKE $1 OR p.description ILIKE $1)
          ORDER BY p.product_id ASC
          LIMIT $2 OFFSET $3;
        `, [searchPattern, safeLimit, safeOffset]);
        return result.rows;
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async getCustomerProductById(productId) {
      try {
        const id = Number(productId);
        const isNumeric = Number.isInteger(id) && id > 0;
        const result = await databasePool.query(`
          SELECT
            p.product_id AS id,
            p.stock_code AS sku,
            p.description AS name,
            p.unit_price::text AS unit_price,
            COALESCE(i.available_qty, 0) AS available,
            (COALESCE(i.available_qty, 0) > 0) AS in_stock
          FROM products p
          LEFT JOIN inventory i ON p.product_id = i.product_id
          WHERE ($1::boolean AND p.product_id = $2) OR p.stock_code = $3;
        `, [isNumeric, isNumeric ? id : -1, String(productId)]);
        return result.rows[0] || null;
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async listStockLedger() {
      try {
        const result = await databasePool.query(`
          SELECT
            l.ledger_id AS id,
            l.transaction_id AS "transactionId",
            st.transaction_type AS type,
            p.product_id AS "productId",
            p.stock_code AS "productSku",
            p.description AS "productName",
            l.quantity_change AS "quantityChange",
            l.available_after AS "availableAfter",
            l.reserved_after AS "reservedAfter",
            COALESCE(u.username, 'system') AS "performedBy",
            l.created_at AS "createdAt",
            COALESCE(st.description, '') AS description
          FROM stock_ledger l
          JOIN stock_transactions st ON l.transaction_id = st.transaction_id
          JOIN products p ON l.product_id = p.product_id
          LEFT JOIN users u ON st.user_id = u.user_id
          ORDER BY l.ledger_id DESC;
        `);
        return result.rows;
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async listAuditLogs() {
      try {
        const result = await databasePool.query(`
          SELECT
            a.audit_id AS id,
            a.action,
            a.details,
            COALESCE(u.username, 'system') AS "performedBy",
            a.created_at AS "createdAt"
          FROM audit_logs a
          LEFT JOIN users u ON a.user_id = u.user_id
          ORDER BY a.audit_id DESC;
        `);
        return result.rows;
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async getDashboardKpis() {
      try {
        const result = await databasePool.query(`
          SELECT
            COUNT(p.product_id)::int AS products,
            COALESCE(SUM(i.available_qty + i.reserved_qty), 0)::int AS "onHand",
            COALESCE(SUM(i.reserved_qty), 0)::int AS reserved,
            COALESCE(SUM(i.available_qty), 0)::int AS available,
            COUNT(CASE WHEN (COALESCE(i.available_qty, 0) + COALESCE(i.reserved_qty, 0)) <= 10 THEN 1 END)::int AS "lowStock"
          FROM products p
          LEFT JOIN inventory i ON p.product_id = i.product_id;
        `);
        return result.rows[0];
      } catch (error) {
        throw mapDbError(error);
      }
    },
  };
}

export const defaultP1Operations = createP1Operations();
