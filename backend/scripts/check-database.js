import pool, { closeDatabasePool } from "../src/engines/dbms/pool.js";

const requiredTables = [
  "products",
  "inventory",
  "orders",
  "order_items",
  "reservations",
  "users",
  "stock_transactions",
  "stock_ledger",
  "audit_logs",
  "historical_customers",
  "historical_invoices",
  "historical_products",
  "historical_invoice_items",
];

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function redactSampleRows(rows) {
  const safeColumns = new Set([
    "historical_item_id",
    "quantity",
    "unit_price",
  ]);
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([column, value]) => [
        column,
        safeColumns.has(column) ? value : "[redacted]",
      ]),
    ),
  );
}

async function verifyDatabase() {
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");

    const databaseResult = await client.query(
      "SELECT current_database() AS database_name, current_schema() AS current_schema",
    );
    const tableResult = await client.query(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE'
         AND table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY table_schema, table_name`,
    );
    const tables = tableResult.rows.map(
      ({ table_schema, table_name }) => `${table_schema}.${table_name}`,
    );
    const tableNames = new Set(
      tableResult.rows.map(({ table_name }) => table_name),
    );
    const historicalTable = tableResult.rows.find(
      ({ table_name }) => table_name === "historical_invoice_items",
    );

    let historicalInvoiceItems = {
      exists: false,
      count: null,
      columns: [],
      sample: [],
    };

    if (historicalTable) {
      const { table_schema: schema, table_name: name } = historicalTable;
      const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
      const countQuery =
        schema === databaseResult.rows[0].current_schema
          ? "SELECT COUNT(*) FROM historical_invoice_items"
          : `SELECT COUNT(*) FROM ${qualifiedTable}`;
      const countResult = await client.query(countQuery);
      const columnResult = await client.query(
        `SELECT column_name, data_type, udt_name, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schema, name],
      );
      const sampleOrder = columnResult.rows.some(
        ({ column_name }) => column_name === "historical_item_id",
      )
        ? ` ORDER BY ${quoteIdentifier("historical_item_id")}`
        : "";
      const sampleResult = await client.query(
        `SELECT * FROM ${qualifiedTable}${sampleOrder} LIMIT 3`,
      );

      historicalInvoiceItems = {
        exists: true,
        count: countResult.rows[0].count,
        columns: columnResult.rows,
        sample: redactSampleRows(sampleResult.rows),
      };
    }

    await client.query("COMMIT");
    return {
      connected: true,
      database: databaseResult.rows[0].database_name,
      tables,
      requiredTables: requiredTables.map((table) => ({
        table,
        exists: tableNames.has(table),
      })),
      historicalInvoiceItems,
    };
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await closeDatabasePool();
  }
}

try {
  const result = await verifyDatabase();
  console.log(JSON.stringify(result, null, 2));
  if (!result.historicalInvoiceItems.exists) {
    process.exitCode = 1;
  }
} catch (error) {
  const code = typeof error?.code === "string" ? ` (${error.code})` : "";
  console.error(
    `Database verification failed${code}. Connection details are intentionally omitted.`,
  );
  process.exitCode = 1;
}
