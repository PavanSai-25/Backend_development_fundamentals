# Lab 2: SQLite database and CRUD routes

## Student Details

- **Name:** Y. N. V. Pavan Sai
- **Registration Number:** 252U1R7099
- **Section:** CSE FSD - [2B]
- **Course:** Backend Development Fundamentals
- **Lab Number:** 02

## Live Link

- **Deployment Status:** Deployment pending.
- **Platform Evaluation:** Serverless hosting platforms such as Vercel execute Express handlers inside ephemeral, stateless environments with read-only filesystems; in that architecture, runtime SQLite write operations (`POST`, `PUT`, `DELETE`) fail or discard state across invocations. For production hosting of Node.js applications with local SQLite databases, containerized or persistent server environments (such as Render or Railway) are recommended.
- **Remaining Steps for Remote Deployment:** Configure persistent volume storage on a cloud host (such as Render Web Service), set environment variable `PORT`, and bind the public domain after passing end-to-end CRUD verification.

## Objective

To connect an Express.js backend application to a local SQLite database using asynchronous drivers (`sqlite` and `sqlite3`), define a relational schema using SQL data definition language, and expose full Create, Read, Update, and Delete (CRUD) operations over HTTP adhering to REST principles and parameterized SQL query security.

## Technologies Used

- **Node.js** (v24.x) - Asynchronous JavaScript runtime
- **Express.js** (v4.x) - HTTP web application framework
- **SQLite3** (v5.x) - Embedded relational database engine
- **sqlite** (v5.x) - Promise-based async wrapper for SQLite3
- **Nodemon** (v3.x, devDependency) - Development utility for automatic server restarts
- **JavaScript** (CommonJS)
- **npm** (Node Package Manager)

## Project Structure

```text
Lab---2/
├── screenshots/
│   ├── cli-before.png
│   ├── get-all.png
│   ├── get-one.png
│   ├── post.png
│   ├── put.png
│   ├── delete.png
│   ├── not-found.png
│   └── cli-after.png
├── .gitignore
├── books.db
├── package.json
├── package-lock.json
├── README.md
├── seed.sql
└── server.js
```

## Package Configuration (`package.json`)

The `package.json` file serves as the manifest for the Node.js project. Key fields include:

- **`name`**: The package identifier (`lab-02`).
- **`version`**: The current semantic version of the project (`1.0.0`).
- **`main`**: The primary entry point file of the server application (`server.js`).
- **`scripts`**:
  - `"start": "node server.js"`: Starts the production Express server.
  - `"dev": "nodemon server.js"`: Starts the server with file watching and auto-reload for local development.
  - `"test"`: Standard script placeholder for automated testing.
- **`dependencies`**:
  - `"express"`: Fast, unopinionated web framework for Node.js.
  - `"sqlite"`: Promise-based wrapper around `sqlite3` enabling clean `async`/`await` database syntax.
  - `"sqlite3"`: Native SQLite engine driver for Node.js.
- **`devDependencies`**:
  - `"nodemon"`: Monitor script that restarts the Node process upon detecting file changes.

## Installation and Setup

### Prerequisites

- Node.js (v18.0.0 or higher recommended) and npm installed.
- SQLite3 CLI (optional, for direct terminal querying).

### Steps to Run

1. Navigate to the project directory:

   ```bash
   cd "Lab---2"
   ```

2. Install project dependencies:

   ```bash
   npm install
   ```

3. Initialize the database from seed data (if rebuilding):

   ```bash
   sqlite3 books.db < seed.sql
   ```

4. Start the Express server:

   ```bash
   npm start
   ```

   *(For development mode with automatic restarts on code edits: `npm run dev`)*

5. The server will listen on port 3000 (or `process.env.PORT`):

   `http://localhost:3000`

## Database

### Table Definition

The application utilizes a single SQLite table named `book`, defined in `seed.sql` as follows:

```sql
CREATE TABLE IF NOT EXISTS book (
    id INTEGER PRIMARY KEY,
    title TEXT,
    author TEXT,
    price INTEGER,
    pages INTEGER
);
```

### Data Fields

| Column Name | Data Type | Constraint | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Unique integer identifier automatically managed by SQLite |
| `title` | TEXT | - | Title of the publication |
| `author` | TEXT | - | Full name of the author |
| `price` | INTEGER | - | Price of the book in whole currency units |
| `pages` | INTEGER | - | Total number of pages |

### How to Rebuild the Database

To reset the database to its pristine state containing the 10 starting sample books:

```bash
sqlite3 books.db < seed.sql
```

### How to Inspect with SQLite CLI

To inspect table contents directly via the SQLite terminal interface:

```bash
sqlite3 books.db
```

Inside the SQLite prompt, execute:

```sql
.headers on
.mode column
SELECT * FROM book;
.exit
```

## Endpoints

### CRUD Operations Table

| Method | Endpoint | Description | Success Status |
|---|---|---|---|
| `GET` | `/books/` | Retrieves the list of all books | `200 OK` |
| `GET` | `/books/:bookId/` | Retrieves a single book by its primary key ID | `200 OK` |
| `POST` | `/books/` | Adds a new book to the database from request body | `201 Created` |
| `PUT` | `/books/:bookId/` | Updates all four fields of an existing book | `200 OK` |
| `DELETE` | `/books/:bookId/` | Deletes a book record by its primary key ID | `200 OK` |

> **Note:** All endpoints seamlessly support requests with or without trailing slashes (e.g., `/books` and `/books/`).

### Request Body Format (for `POST` and `PUT`)

Requests sending book data must include `Content-Type: application/json` and conform to the following schema:

```json
{
  "title": "Clean Architecture",
  "author": "Robert C. Martin",
  "price": 550,
  "pages": 432
}
```

### Error Responses Table

| HTTP Status | Trigger Condition | Response Body Example |
|---|---|---|
| `400 Bad Request` | Non-integer or non-positive `bookId` parameter (e.g. `/books/abc`) | `{"error": "Invalid bookId. ID must be a positive whole number."}` |
| `400 Bad Request` | Missing or invalid body fields on `POST` or `PUT` | `{"error": "Invalid or missing fields. Required: title (string), author (string), price (non-negative integer), pages (positive integer)."}` |
| `400 Bad Request` | Malformed JSON syntax in request body | `{"error": "Malformed JSON payload in request body"}` |
| `404 Not Found` | Book with specified `bookId` does not exist (`GET`, `PUT`, `DELETE`) | `{"error": "Book with id 999 not found."}` |
| `404 Not Found` | Undefined URL path or method | `{"error": "404 - Route Not Found"}` |
| `500 Internal Server Error`| Unexpected database query failure or server runtime exception | `{"error": "Internal Server Error"}` |

### Security: Parameterized Queries

To completely prevent SQL injection attacks, all SQL queries incorporating request parameters (`bookId`) or body values (`title`, `author`, `price`, `pages`) exclusively use `?` placeholders:

```javascript
// Parameterized GET query
await db.get("SELECT id, title, author, price, pages FROM book WHERE id = ?", [bookId]);

// Parameterized INSERT query
await db.run(
    "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
    [title.trim(), author.trim(), price, pages]
);
```

## Screenshots

### 1. SQLite CLI Initial State (`cli-before.png`)
Displays the initial 10 records seeded in `books.db` using the SQLite command-line interface.

![CLI Initial State](screenshots/cli-before.png)

### 2. Get All Books (`get-all.png`)
Displays an HTTP `GET /books/` request returning status `200 OK` and a JSON array of 10 books.

![Get All Books](screenshots/get-all.png)

### 3. Get Single Book (`get-one.png`)
Displays an HTTP `GET /books/1/` request returning status `200 OK` and the single book object for ID 1.

![Get Single Book](screenshots/get-one.png)

### 4. Create Book (`post.png`)
Displays an HTTP `POST /books/` request with a JSON body returning status `201 Created` with the newly assigned ID.

![Create Book](screenshots/post.png)

### 5. Update Book (`put.png`)
Displays an HTTP `PUT /books/11/` request updating all fields of the newly created book, returning status `200 OK`.

![Update Book](screenshots/put.png)

### 6. Delete Book (`delete.png`)
Displays an HTTP `DELETE /books/11/` request returning status `200 OK` confirming record removal.

![Delete Book](screenshots/delete.png)

### 7. Route and Resource Not Found (`not-found.png`)
Displays an HTTP request demonstrating `404 Not Found` error handling for undefined routes and missing book IDs.

![Not Found](screenshots/not-found.png)

### 8. SQLite CLI Final State (`cli-after.png`)
Displays a query execution in the SQLite CLI confirming the final state of the database after test operations.

![CLI Final State](screenshots/cli-after.png)

## HTTP Status Codes

- **`200 OK`**: Standard response indicating that the request succeeded (used for successful `GET`, `PUT`, and `DELETE` operations).
- **`201 Created`**: Indicates that the request succeeded and resulted in the creation of a new resource (used for successful `POST /books/`).
- **`400 Bad Request`**: Indicates that the server cannot process the request due to client error (invalid route parameter, invalid field data type, missing payload property, or malformed JSON syntax).
- **`404 Not Found`**: Indicates that the requested resource could not be found on the server (non-existent `bookId` or undefined URL route).
- **`500 Internal Server Error`**: Generic error status indicating an unexpected server-side exception occurred while processing the request.

## Viva Questions and Answers

### 1. What is SQL Injection, and how do parameterized queries with `?` placeholders prevent it?

- **Answer:** SQL Injection is a code injection vulnerability where malicious SQL commands are inserted into user-supplied input strings, manipulating the database into executing unintended instructions (such as extracting unauthorized data or dropping tables). Parameterized queries prevent this by separating the query template from user input. When using `?` placeholders, the database engine treats input strictly as literal values rather than executable SQL code, regardless of special characters like `'`, `"`, `--`, or `OR 1=1`.

### 2. What is the difference between `PUT` and `POST` HTTP methods?

- **Answer:** 
  - **`POST`**: Used to create a new subordinate resource. It is **not idempotent**; sending identical `POST` requests multiple times will create multiple new rows with distinct primary key IDs.
  - **`PUT`**: Used to update or replace an existing resource at a specific URI. It is **idempotent**; sending identical `PUT` requests repeatedly produces the exact same final database state.

### 3. Why is HTTP status `201 Created` used for `POST` instead of `200 OK`?

- **Answer:** `200 OK` is a generic success code indicating the request completed, whereas `201 Created` explicitly signals to the client that a brand-new resource was successfully instantiated as a consequence of the request. In RESTful API design, `201 Created` is accompanied by identifier metadata (such as the new record's primary key ID or a `Location` header) so the client immediately knows how to locate and reference the new resource.

### 4. What is a `PRIMARY KEY` in SQLite, and what makes `INTEGER PRIMARY KEY` special?

- **Answer:** A `PRIMARY KEY` is a constraint that uniquely identifies each row in a database table, enforcing uniqueness and non-null values. In SQLite, defining a column specifically as `INTEGER PRIMARY KEY` creates an alias for SQLite's internal 64-bit signed integer `ROWID`. This enables automatic, sequential auto-incrementing key generation without requiring a separate sequence generator, and delivers maximum lookup performance through B-tree indexing.

### 5. What are the advantages and architectural trade-offs of SQLite?

- **Answer:** 
  - **Advantages:** SQLite is serverless, zero-configuration, and self-contained within a single disk file. It requires no network socket overhead, making it exceptionally fast for read-heavy workloads, embedded systems, local development, and educational labs.
  - **Trade-offs:** SQLite enforces file-level locking during write operations, meaning it is not suitable for distributed high-concurrency write workloads or serverless compute architectures where execution instances share no persistent local filesystem.

## Problems Faced and Solutions

1. **Absence of SQLite CLI binary on Windows development environment**:
   - *Problem:* Running command-line shell redirections such as `sqlite3 books.db < seed.sql` failed on Windows because the standalone `sqlite3.exe` executable was not installed globally on the system PATH.
   - *Solution:* Implemented automated database initialization using Node.js and the `sqlite3` driver to execute the SQL statements from `seed.sql`, ensuring that `books.db` is deterministically generated from `seed.sql` on all operating systems.

2. **Server crash on malformed JSON request bodies**:
   - *Problem:* When a client transmits invalid JSON syntax (e.g. unclosed brackets or trailing commas), the default `express.json()` middleware throws an unhandled `SyntaxError`, which can terminate the process or output HTML stack traces.
   - *Solution:* Added specialized error middleware directly below `express.json()` that intercepts `SyntaxError` with status 400 and responds gracefully with a clean `400 Bad Request` JSON payload.

3. **Trailing slash inconsistencies in route matching**:
   - *Problem:* Clients and API testing tools often vary between requesting `/books` and `/books/`, or `/books/1` and `/books/1/`. Standard single-string route definitions in Express can reject the alternate format with a 404 error.
   - *Solution:* Configured route path arrays `["/books", "/books/"]` and `["/books/:bookId", "/books/:bookId/"]` to uniformly handle both URL conventions.

## Git and Repository Notes

- The `.gitignore` file explicitly excludes `node_modules/` and `.env` from source control.
- **Decision on `books.db`:** In enterprise production, binary databases are excluded from Git to prevent repository bloat and merge conflicts. However, for academic lab submissions, committing `books.db` alongside `seed.sql` ensures that evaluators can clone and run the application instantly with populated data, without requiring external database initialization steps.
- The project adheres strictly to zero-secret policies, with no API tokens, sensitive credentials, or personal keys stored in the codebase.
