const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, "books.db");

let db = null;

// Parse incoming JSON request bodies
app.use(express.json());

// Middleware to catch malformed JSON syntax errors in request bodies
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({
            message: "Malformed JSON payload in request body"
        });
    }
    next(err);
});

// Helper: validate positive whole number ID from route parameters
const parsePositiveIntegerId = (value) => {
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        return null;
    }
    const num = Number(value);
    if (!Number.isSafeInteger(num) || num <= 0) {
        return null;
    }
    return num;
};

// Helper: validate non-negative integer query parameter (0 or more)
const parseNonNegativeInteger = (value, defaultVal) => {
    if (value === undefined || value === null || value === "") {
        return defaultVal;
    }
    const str = String(value).trim();
    if (!/^\d+$/.test(str)) {
        return null;
    }
    const num = Number(str);
    if (!Number.isSafeInteger(num) || num < 0) {
        return null;
    }
    return num;
};

// Helper: validate pagination limit query parameter (1 to 100)
const parseLimit = (value, defaultVal = 10) => {
    if (value === undefined || value === null || value === "") {
        return defaultVal;
    }
    const str = String(value).trim();
    if (!/^\d+$/.test(str)) {
        return null;
    }
    const num = Number(str);
    if (!Number.isSafeInteger(num) || num < 1 || num > 100) {
        return null;
    }
    return num;
};

// Whitelist configuration for sorting to prevent SQL injection
const ALLOWED_ORDER_BY = ["id", "title", "author", "price", "pages"];
const ALLOWED_ORDER = ["ASC", "DESC"];

// Helper: validate JSON request body for POST and PUT
const validateBookPayload = (body) => {
    if (!body || typeof body !== "object") {
        return false;
    }
    const { title, author, price, pages } = body;

    if (
        typeof title !== "string" || title.trim().length === 0 ||
        typeof author !== "string" || author.trim().length === 0 ||
        typeof price !== "number" || !Number.isInteger(price) || price < 0 ||
        typeof pages !== "number" || !Number.isInteger(pages) || pages < 0
    ) {
        return false;
    }
    return true;
};

// 1. GET /books/ - List books with search, sort, pagination, and price filter
app.get(["/books", "/books/"], async (req, res, next) => {
    try {
        const { search_q, order_by, order, limit, offset, min_price, max_price } = req.query;

        // Validate and sanitize order_by
        const rawOrderBy = order_by !== undefined && order_by !== "" ? String(order_by).toLowerCase().trim() : "id";
        if (!ALLOWED_ORDER_BY.includes(rawOrderBy)) {
            return res.status(400).json({
                message: `Invalid order_by parameter. Allowed columns: ${ALLOWED_ORDER_BY.join(", ")}`
            });
        }
        const sanitizedOrderBy = rawOrderBy;

        // Validate and sanitize order
        const rawOrder = order !== undefined && order !== "" ? String(order).toUpperCase().trim() : "ASC";
        if (!ALLOWED_ORDER.includes(rawOrder)) {
            return res.status(400).json({
                message: `Invalid order parameter. Allowed values: ${ALLOWED_ORDER.join(", ")}`
            });
        }
        const sanitizedOrder = rawOrder;

        // Validate limit (1 to 100, default 10)
        const parsedLimit = parseLimit(limit, 10);
        if (parsedLimit === null) {
            return res.status(400).json({
                message: "Invalid limit parameter. Must be an integer between 1 and 100"
            });
        }

        // Validate offset (non-negative integer, default 0)
        const parsedOffset = parseNonNegativeInteger(offset, 0);
        if (parsedOffset === null) {
            return res.status(400).json({
                message: "Invalid offset parameter. Must be a non-negative integer"
            });
        }

        // Validate min_price (non-negative integer, default 0)
        const parsedMinPrice = parseNonNegativeInteger(min_price, 0);
        if (parsedMinPrice === null) {
            return res.status(400).json({
                message: "Invalid min_price parameter. Must be a non-negative integer"
            });
        }

        // Validate max_price (non-negative integer, default 2147483647)
        const parsedMaxPrice = parseNonNegativeInteger(max_price, 2147483647);
        if (parsedMaxPrice === null) {
            return res.status(400).json({
                message: "Invalid max_price parameter. Must be a non-negative integer"
            });
        }

        // Cross-validation: min_price cannot be greater than max_price
        if (parsedMinPrice > parsedMaxPrice) {
            return res.status(400).json({
                message: "min_price cannot be greater than max_price"
            });
        }

        // Build SQL query safely with parameterization
        const conditions = [];
        const params = [];

        if (search_q !== undefined && search_q !== null && String(search_q).trim().length > 0) {
            conditions.push("title LIKE ?");
            params.push(`%${String(search_q).trim()}%`);
        }

        conditions.push("price >= ?");
        params.push(parsedMinPrice);

        conditions.push("price <= ?");
        params.push(parsedMaxPrice);

        const whereClause = `WHERE ${conditions.join(" AND ")}`;
        const sqlQuery = `SELECT id, title, author, price, pages FROM book ${whereClause} ORDER BY ${sanitizedOrderBy} ${sanitizedOrder} LIMIT ? OFFSET ?`;
        params.push(parsedLimit, parsedOffset);

        const books = await db.all(sqlQuery, params);
        res.status(200).json(books);
    } catch (error) {
        next(error);
    }
});

// 2. GET /books/:bookId/ - Retrieve a single book by ID
app.get(["/books/:bookId", "/books/:bookId/"], async (req, res, next) => {
    try {
        const bookId = parsePositiveIntegerId(req.params.bookId);
        if (bookId === null) {
            return res.status(400).json({
                message: "Invalid bookId. ID must be a positive whole number"
            });
        }

        const book = await db.get(
            "SELECT id, title, author, price, pages FROM book WHERE id = ?",
            [bookId]
        );

        if (!book) {
            return res.status(404).json({
                message: `Book with id ${bookId} not found`
            });
        }

        res.status(200).json(book);
    } catch (error) {
        next(error);
    }
});

// 3. POST /books/ - Add a new book
app.post(["/books", "/books/"], async (req, res, next) => {
    try {
        if (!validateBookPayload(req.body)) {
            return res.status(400).json({
                message: "Invalid or missing body fields. Required: title (non-empty string), author (non-empty string), price (non-negative integer), pages (non-negative integer)"
            });
        }

        const { title, author, price, pages } = req.body;
        const result = await db.run(
            "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
            [title.trim(), author.trim(), price, pages]
        );

        res.status(201).json({
            id: result.lastID
        });
    } catch (error) {
        next(error);
    }
});

// 4. PUT /books/:bookId/ - Replace all fields of an existing book
app.put(["/books/:bookId", "/books/:bookId/"], async (req, res, next) => {
    try {
        const bookId = parsePositiveIntegerId(req.params.bookId);
        if (bookId === null) {
            return res.status(400).json({
                message: "Invalid bookId. ID must be a positive whole number"
            });
        }

        if (!validateBookPayload(req.body)) {
            return res.status(400).json({
                message: "Invalid or missing body fields. Required: title (non-empty string), author (non-empty string), price (non-negative integer), pages (non-negative integer)"
            });
        }

        const existingBook = await db.get(
            "SELECT id FROM book WHERE id = ?",
            [bookId]
        );

        if (!existingBook) {
            return res.status(404).json({
                message: `Book with id ${bookId} not found`
            });
        }

        const { title, author, price, pages } = req.body;
        await db.run(
            "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
            [title.trim(), author.trim(), price, pages, bookId]
        );

        res.status(200).json({
            message: `Book with id ${bookId} updated successfully`
        });
    } catch (error) {
        next(error);
    }
});

// 5. DELETE /books/:bookId/ - Delete a book by ID
app.delete(["/books/:bookId", "/books/:bookId/"], async (req, res, next) => {
    try {
        const bookId = parsePositiveIntegerId(req.params.bookId);
        if (bookId === null) {
            return res.status(400).json({
                message: "Invalid bookId. ID must be a positive whole number"
            });
        }

        const existingBook = await db.get(
            "SELECT id FROM book WHERE id = ?",
            [bookId]
        );

        if (!existingBook) {
            return res.status(404).json({
                message: `Book with id ${bookId} not found`
            });
        }

        await db.run("DELETE FROM book WHERE id = ?", [bookId]);

        res.status(200).json({
            message: `Book with id ${bookId} deleted successfully`
        });
    } catch (error) {
        next(error);
    }
});

// Fallback middleware for undefined routes
app.use((req, res) => {
    res.status(404).json({
        message: "404 - Route Not Found"
    });
});

// Global error-handling middleware for unhandled exceptions
app.use((err, req, res, next) => {
    console.error("Unhandled Database/Server Error:", err);
    res.status(500).json({
        message: "Internal Server Error"
    });
});

// Connect to the SQLite database and start listening for connections
const initializeDatabaseAndServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
};

initializeDatabaseAndServer();
