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
            error: "Malformed JSON payload in request body"
        });
    }
    next(err);
});

// Helper function to validate positive integer IDs
const parsePositiveIntegerId = (value) => {
    if (!/^\d+$/.test(value)) {
        return null;
    }
    const num = Number(value);
    if (!Number.isSafeInteger(num) || num <= 0) {
        return null;
    }
    return num;
};

// Helper function to validate request body fields for book creation and updates
const validateBookPayload = (body) => {
    const { title, author, price, pages } = body;

    if (
        typeof title !== "string" || title.trim().length === 0 ||
        typeof author !== "string" || author.trim().length === 0 ||
        typeof price !== "number" || !Number.isInteger(price) || price < 0 ||
        typeof pages !== "number" || !Number.isInteger(pages) || pages <= 0
    ) {
        return false;
    }
    return true;
};

// 1. GET /books/ - Returns all books
app.get(["/books", "/books/"], async (req, res, next) => {
    try {
        const books = await db.all("SELECT id, title, author, price, pages FROM book ORDER BY id ASC");
        res.status(200).json(books);
    } catch (error) {
        next(error);
    }
});

// 2. GET /books/:bookId/ - Returns one book by ID
app.get(["/books/:bookId", "/books/:bookId/"], async (req, res, next) => {
    try {
        const bookId = parsePositiveIntegerId(req.params.bookId);
        if (bookId === null) {
            return res.status(400).json({
                error: "Invalid bookId. ID must be a positive whole number."
            });
        }

        const book = await db.get(
            "SELECT id, title, author, price, pages FROM book WHERE id = ?",
            [bookId]
        );

        if (!book) {
            return res.status(404).json({
                error: `Book with id ${bookId} not found.`
            });
        }

        res.status(200).json(book);
    } catch (error) {
        next(error);
    }
});

// 3. POST /books/ - Adds a new book
app.post(["/books", "/books/"], async (req, res, next) => {
    try {
        if (!validateBookPayload(req.body)) {
            return res.status(400).json({
                error: "Invalid or missing fields. Required: title (string), author (string), price (non-negative integer), pages (positive integer)."
            });
        }

        const { title, author, price, pages } = req.body;
        const result = await db.run(
            "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
            [title.trim(), author.trim(), price, pages]
        );

        res.status(201).json({
            message: "Book added successfully",
            id: result.lastID
        });
    } catch (error) {
        next(error);
    }
});

// 4. PUT /books/:bookId/ - Updates all fields of an existing book
app.put(["/books/:bookId", "/books/:bookId/"], async (req, res, next) => {
    try {
        const bookId = parsePositiveIntegerId(req.params.bookId);
        if (bookId === null) {
            return res.status(400).json({
                error: "Invalid bookId. ID must be a positive whole number."
            });
        }

        if (!validateBookPayload(req.body)) {
            return res.status(400).json({
                error: "Invalid or missing fields. Required: title (string), author (string), price (non-negative integer), pages (positive integer)."
            });
        }

        const existingBook = await db.get(
            "SELECT id FROM book WHERE id = ?",
            [bookId]
        );

        if (!existingBook) {
            return res.status(404).json({
                error: `Book with id ${bookId} not found.`
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

// 5. DELETE /books/:bookId/ - Deletes a book by ID
app.delete(["/books/:bookId", "/books/:bookId/"], async (req, res, next) => {
    try {
        const bookId = parsePositiveIntegerId(req.params.bookId);
        if (bookId === null) {
            return res.status(400).json({
                error: "Invalid bookId. ID must be a positive whole number."
            });
        }

        const existingBook = await db.get(
            "SELECT id FROM book WHERE id = ?",
            [bookId]
        );

        if (!existingBook) {
            return res.status(404).json({
                error: `Book with id ${bookId} not found.`
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
        error: "404 - Route Not Found"
    });
});

// Global error-handling middleware for unhandled exceptions
app.use((err, req, res, next) => {
    console.error("Internal Server Error:", err);
    res.status(500).json({
        error: "Internal Server Error"
    });
});

// Connect to the database and start the server
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
