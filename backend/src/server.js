
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Inventory Management System Backend is Running!");
});

app.get("/health", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database() AS database"
        );

        res.json({
            status: "success",
            message: "Backend and database connected",
            database: result.rows[0].database
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: "error",
            message: "Database connection failed"
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
