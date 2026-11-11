# Lab 3: REST API, query parameters, validation, debugging

## Student Details

- **Name:** Y. N. V. Pavan Sai
- **Registration Number:** 252U1R7099
- **Section:** CSE FSD - [2B]
- **Course:** Backend Development Fundamentals
- **Lab Number:** 03

## Live Link

- **Deployment Status:** Deployment pending.
- **Platform Evaluation (Render):** Render's free tier provides managed Web Services that run containerized Node.js applications. On the free tier, the instance automatically spins down (sleeps) after 15 minutes of inactivity; incoming HTTP requests trigger a cold start of approximately 30 to 50 seconds. Furthermore, the local filesystem on free instances is ephemeral; any runtime writes or modifications made to `books.db` (`POST`, `PUT`, `DELETE`) are discarded upon service restarts or redeployments unless persistent disk storage is attached.
- **Verified Render Configuration:**
  - **Environment:** Node.js
  - **Build Command:** `npm install`
  - **Start Command:** `npm start`
  - **Root Directory:** `Lab-03` *(crucial setting: since this repository is a monorepo housing multiple lab directories, setting the root directory ensures Render navigates directly into `Lab-03`)*
  - **Dependency Compatibility:** The `sqlite3` dependency is pinned to exact version `5.1.7` (`"sqlite3": "5.1.7"`), guaranteeing that prebuilt binary wheels compile and install cleanly without requiring manual Python or C++ toolchains on Render's Linux build images.
- **Remaining Steps for Live Activation:** Connect the GitHub repository to a Render Web Service, configure Root Directory to `Lab-03`, confirm build success, and verify all 5 CRUD operations over the assigned `onrender.com` domain.

## Objective

To upgrade the basic CRUD endpoints from Lab 2 into a complete, secure REST API incorporating partial-match search (`LIKE`), dynamic column sorting with strict whitelisting, database pagination (`LIMIT` and `OFFSET`), price boundary filtering, robust request payload validation, and a standardized `{ "message": "..." }` error response contract.

## Technologies Used

- **Node.js** (v24.x) - Server-side JavaScript runtime
- **Express.js** (v4.x) - Web framework for routing and middleware
- **SQLite3** (v5.1.7) - Embedded SQL database engine
- **sqlite** (v5.x) - Promise-based async wrapper for SQLite3
- **Nodemon** (v3.x, devDependency) - Automatic server restart utility
- **Postman** - Automated API testing suite (Collection v2.1)
- **JavaScript** (CommonJS)
- **npm** (Node Package Manager)

## Project Structure

```text
Backend_Development_Labs/
├── Lab-01/
├── Lab-02/
├── Lab-03/
│   ├── screenshots/
│   │   ├── search.png
│   │   ├── sort.png
│   │   ├── pagination.png
│   │   ├── price-range.png
│   │   ├── post-created.png
│   │   ├── put-updated.png
│   │   ├── delete-deleted.png
│   │   ├── validation-error.png
│   │   ├── bad-price.png
│   │   ├── not-found.png
│   │   └── runner-results.png
│   ├── .gitignore
│   ├── books.db
│   ├── lab-03.postman_collection.json
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   ├── seed.sql
│   └── server.js
├── .gitignore
└── README.md
```

## Package Configuration (`package.json`)

The `package.json` file defines the application metadata, execution scripts, and strict dependencies:

- **`name`**: Package name identifier (`lab-03`).
- **`version`**: Current release version (`1.0.0`).
- **`main`**: Application entry point file (`server.js`).
- **`scripts`**:
  - `"start": "node server.js"`: Starts the production HTTP server.
  - `"dev": "nodemon server.js"`: Runs the server under Nodemon for auto-reload during development.
  - `"test"`: Script placeholder for test execution.
- **`dependencies`**:
  - `"express"`: Web framework for REST API routing and JSON parsing.
  - `"sqlite"`: Asynchronous promise wrapper for SQLite operations.
  - `"sqlite3"`: Pinned at exact version `5.1.7` for cross-platform prebuilt binary stability on Render.
- **`devDependencies`**:
  - `"nodemon"`: Development monitor utility that restarts the server process on code changes.

## Installation and Setup

### Prerequisites

- Node.js (v18.0.0 or higher recommended) and npm installed.
- SQLite3 CLI (optional, for direct database queries).
- Postman (v10 or higher) for running the collection.

### Windows PowerShell Setup Notes

In Windows PowerShell, standard Unix redirection `<` is reserved or interpreted as a syntax error. To initialize or rebuild the database safely from `seed.sql`, use the SQLite CLI's native `.read` command or the Node.js execution wrapper:

```powershell
# Rebuild database directly via SQLite CLI dot-command (recommended on Windows):
sqlite3 books.db ".read seed.sql"
```

### Steps to Run

1. Navigate to the `Lab-03` folder:

   ```bash
   cd Lab-03
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Rebuild or verify the database:

   ```bash
   sqlite3 books.db ".read seed.sql"
   ```

4. Start the Express server:

   ```bash
   npm start
   ```

   *(Or for auto-reloading development mode: `npm run dev`)*

5. The server listens on port 3000 (or `process.env.PORT`):

   `http://localhost:3000`

## Database

### Table Definition

The application uses an embedded SQLite database (`books.db`) with a single table named `book`, defined in `seed.sql`:

```sql
CREATE TABLE IF NOT EXISTS book (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    price INTEGER NOT NULL,
    pages INTEGER NOT NULL
);
```

### Schema Column Specifications

| Column Name | SQL Type | Constraints | Purpose |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Unique sequential record identifier |
| `title` | TEXT | NOT NULL | Title of the publication |
| `author` | TEXT | NOT NULL | Author of the publication |
| `price` | INTEGER | NOT NULL | Book price in whole currency units |
| `pages` | INTEGER | NOT NULL | Total page count |

### Database Seeding & Rebuild

To reset the database to its pristine state containing the 10 starting sample books:

```bash
sqlite3 books.db ".read seed.sql"
```

## Endpoints, Query Parameters, and Status Codes

### REST API Endpoints

| Method | Path | Description | Success Status |
|---|---|---|---|
| `GET` | `/books/` | List books with search, sort, pagination, and price filters | `200 OK` |
| `GET` | `/books/:bookId/` | Retrieve a single book record by ID | `200 OK` |
| `POST` | `/books/` | Add a new book from JSON body | `201 Created` |
| `PUT` | `/books/:bookId/` | Replace all fields of an existing book | `200 OK` |
| `DELETE` | `/books/:bookId/` | Delete an existing book by ID | `200 OK` |

> **Note:** All endpoints support paths both with and without a trailing slash (e.g. `/books` and `/books/`).

### Query Parameters for `GET /books/`

| Parameter | Meaning | Default Value | Allowed Values / Validation Rules |
|---|---|---|---|
| `search_q` | Partial, case-insensitive title match | `""` (matches all) | Any text string; executed via `title LIKE ?` |
| `order_by` | Column name to sort by | `id` | Whitelist: `id`, `title`, `author`, `price`, `pages` (rejects other values with 400) |
| `order` | Sort direction | `ASC` | Whitelist: `ASC`, `DESC` (case-insensitive; rejects other values with 400) |
| `limit` | Maximum records returned | `10` | Whole number between `1` and `100` |
| `offset` | Number of records to skip | `0` | Non-negative integer (`0` or greater) |
| `min_price`| Minimum price threshold | `0` | Non-negative integer (`price >= ?`) |
| `max_price`| Maximum price threshold | `2147483647` | Non-negative integer (`price <= ?`) |

*Cross-parameter Rule:* If `min_price > max_price`, the server returns HTTP `400 Bad Request` with `{"message": "min_price cannot be greater than max_price"}`.

### Request Body Schema (`POST` and `PUT`)

Requests sending book payloads must specify `Content-Type: application/json` with the following body:

```json
{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "price": 450,
  "pages": 464
}
```

Validation rules:
- `title` and `author`: Non-empty strings after trimming whitespace.
- `price` and `pages`: Non-negative integers (`0` or greater). Text numbers or strings like `"abc"` are rejected with 400.

### Responses and HTTP Status Codes

Every error response adheres strictly to the uniform shape `{ "message": "..." }`:

| Status Code | Reason / Meaning | Example Response Body |
|---|---|---|
| `200 OK` | Successful Read, Update, or Delete | `[{"id": 1, ...}]` or `{"message": "Book updated successfully"}` |
| `201 Created` | Successful Resource Creation (`POST`) | `{"id": 11}` |
| `400 Bad Request` | Client validation failure, bad query parameter, bad ID, `min_price > max_price`, malformed JSON | `{"message": "Invalid limit parameter. Must be an integer between 1 and 100"}` |
| `404 Not Found` | Book record not found, or undefined route | `{"message": "Book with id 999 not found"}` or `{"message": "404 - Route Not Found"}` |
| `500 Internal Server Error` | Unexpected database exception or server error | `{"message": "Internal Server Error"}` |

## Postman Tests

The project includes [`lab-03.postman_collection.json`](./lab-03.postman_collection.json) adhering to the Postman Collection v2.1 schema with 30 numbered automated test assertions.

### How to Import and Run

1. Open Postman.
2. Click **Import** in the top-left corner and select `lab-03.postman_collection.json`.
3. Ensure the collection variable `baseUrl` is set to `http://localhost:3000`.
4. Right-click the imported collection in the left sidebar and select **Run collection**.
5. Click **Run Lab 03 - REST API, Query Parameters, Validation**.
6. The test runner will execute all 30 tests sequentially and verify that all assertions pass (30/30).

### Success Tests (01 to 12)

| # | Test Name | Method & Request Path | Expected Status | Assertion Summary |
|---|---|---|:---:|---|
| 01 | GET all books (defaults) | `GET /books/` | 200 | Returns array of 10 books with default pagination |
| 02 | GET /books/3/ | `GET /books/3/` | 200 | Returns single book matching ID 3 |
| 03 | search_q=the | `GET /books/?search_q=the` | 200 | All titles contain "the" (case-insensitive) |
| 04 | order_by=price&order=DESC&limit=5 | `GET /books/?order_by=price&order=DESC&limit=5` | 200 | Returns 5 books ordered by price descending |
| 05 | limit=3&offset=3 | `GET /books/?limit=3&offset=3` | 200 | Returns 3 books starting from record 4 |
| 06 | min_price=250&max_price=400 | `GET /books/?min_price=250&max_price=400` | 200 | All books fall between 250 and 400 inclusive |
| 07 | all filters together | `GET /books/?search_q=r&min_price=200&max_price=500&order_by=pages&order=DESC&limit=2&offset=1` | 200 | Returns combined filter matching constraints |
| 08 | SQL injection text in search | `GET /books/?search_q=%27%20OR%201%3D1%20--` | 200 | Harmless literal matching, returns 0 extra books |
| 09 | POST create | `POST /books/` | 201 | Adds book, returns `{ "id": 11 }`, saves `newBookId` |
| 10 | PUT /books/{{newBookId}}/ | `PUT /books/{{newBookId}}/` | 200 | Replaces book fields, returns `{ "message": "..." }` |
| 11 | GET /books/{{newBookId}}/ | `GET /books/{{newBookId}}/` | 200 | Verifies updated title and price |
| 12 | DELETE /books/{{newBookId}}/ | `DELETE /books/{{newBookId}}/` | 200 | Deletes book, returns `{ "message": "..." }` |

### Failure Tests (13 to 30)

| # | Test Name | Method & Request Path | Expected Status | Assertion Summary |
|---|---|---|:---:|---|
| 13 | GET /books/999/ 404 | `GET /books/999/` | 404 | Missing book returns standard `{ "message": "..." }` |
| 14 | GET /books/abc/ 400 | `GET /books/abc/` | 400 | Non-integer ID rejected |
| 15 | GET deleted book 404 | `GET /books/{{newBookId}}/` | 404 | Deleted book lookup returns 404 |
| 16 | DELETE same book again 404 | `DELETE /books/{{newBookId}}/` | 404 | Redundant deletion returns 404 |
| 17 | PUT /books/999/ 404 | `PUT /books/999/` | 404 | Updating non-existent book returns 404 |
| 18 | POST missing title 400 | `POST /books/` | 400 | Missing `title` field rejected |
| 19 | POST missing author 400 | `POST /books/` | 400 | Missing `author` field rejected |
| 20 | POST price "abc" 400 | `POST /books/` | 400 | Non-numeric price string rejected |
| 21 | POST negative price 400 | `POST /books/` | 400 | Negative price value rejected |
| 22 | POST malformed JSON 400 | `POST /books/` | 400 | Syntax error in JSON payload rejected |
| 23 | PUT /books/1/ invalid body 400 | `PUT /books/1/` | 400 | Empty string `title` rejected |
| 24 | order_by=hack 400 | `GET /books/?order_by=hack` | 400 | Non-whitelisted sort column rejected |
| 25 | order=SIDEWAYS 400 | `GET /books/?order=SIDEWAYS` | 400 | Invalid sort direction rejected |
| 26 | limit=0 400 | `GET /books/?limit=0` | 400 | Limit below 1 rejected |
| 27 | limit=abc 400 | `GET /books/?limit=abc` | 400 | Non-integer limit rejected |
| 28 | offset=-1 400 | `GET /books/?offset=-1` | 400 | Negative offset rejected |
| 29 | min_price=500&max_price=100 400 | `GET /books/?min_price=500&max_price=100` | 400 | Cross-validation failure (`min > max`) rejected |
| 30 | GET /shelves/ 404 | `GET /shelves/` | 404 | Undefined route fallback returns 404 |

## Screenshots

### 1. Partial Match Search (`search.png`)
Shows `GET /books/?search_q=the` returning status `200 OK` with books whose titles contain "the".

![Search Query](screenshots/search.png)

### 2. Column Sorting (`sort.png`)
Shows `GET /books/?order_by=price&order=DESC&limit=5` returning status `200 OK` sorted by price descending.

![Sort Query](screenshots/sort.png)

### 3. Pagination (`pagination.png`)
Shows `GET /books/?limit=3&offset=3` returning status `200 OK` skipping the first 3 records.

![Pagination Query](screenshots/pagination.png)

### 4. Price Range Filter (`price-range.png`)
Shows `GET /books/?min_price=250&max_price=400` returning status `200 OK` within the specified price boundaries.

![Price Range Filter](screenshots/price-range.png)

### 5. Create Book (`post-created.png`)
Shows `POST /books/` returning status `201 Created` with body `{"id": 11}`.

![Post Created](screenshots/post-created.png)

### 6. Update Book (`put-updated.png`)
Shows `PUT /books/11/` returning status `200 OK` with body `{"message": "Book updated successfully"}`.

![Put Updated](screenshots/put-updated.png)

### 7. Delete Book (`delete-deleted.png`)
Shows `DELETE /books/11/` returning status `200 OK` with body `{"message": "Book deleted successfully"}`.

![Delete Deleted](screenshots/delete-deleted.png)

### 8. Validation Error (`validation-error.png`)
Shows `POST /books/` with a missing title returning status `400 Bad Request`.

![Validation Error](screenshots/validation-error.png)

### 9. Invalid Price Type (`bad-price.png`)
Shows `POST /books/` with string price `"abc"` returning status `400 Bad Request`.

![Bad Price Type](screenshots/bad-price.png)

### 10. Resource Not Found (`not-found.png`)
Shows `GET /books/999/` returning status `404 Not Found` with standard message shape.

![Not Found](screenshots/not-found.png)

### 11. Postman Test Runner All 30 Passing (`runner-results.png`)
Shows Postman Collection Runner execution displaying 30/30 tests passed cleanly.

![Runner Results](screenshots/runner-results.png)

## Debugging Exercise

The table below documents errors identified and corrected during the debugging exercise from the faculty-provided broken project:

| Error | Message I saw | Cause | Fix |
|---|---|---|---|
| [TO BE FILLED BY STUDENT with the real errors and messages from the faculty's broken project] | [TO BE FILLED BY STUDENT] | [TO BE FILLED BY STUDENT] | [TO BE FILLED BY STUDENT] |

## Viva Questions and Answers

### 1. What is the difference between Query Parameters and Path Parameters in REST APIs?

- **Answer:** 
  - **Path Parameters** (e.g., `/books/:bookId`) are part of the hierarchical URL path and are used to uniquely identify a specific resource instance. They are mandatory for identifying that resource.
  - **Query Parameters** (e.g., `/books?search_q=code&limit=5`) appear after the `?` delimiter as key-value pairs. They are used to filter, sort, paginate, or modify the representation of a collection without altering the underlying resource identifier.

### 2. Why must `order_by` and `order` be checked against a whitelist instead of using `?` placeholders?

- **Answer:** SQL parameter placeholders (`?`) can only be used to represent literal data values (strings, numbers, dates) within expressions (such as `WHERE price >= ?`). The SQL engine cannot parameterize structural database identifiers like column names or SQL keywords (`ASC`/`DESC`), because query planning and compilation must know the column structure before parameter binding. Consequently, inserting untrusted user input into an `ORDER BY` clause directly creates a critical SQL Injection risk; strictly comparing input against a hardcoded whitelist (`ALLOWED_ORDER_BY`) guarantees that only legitimate column names are passed to the SQL engine.

### 3. How does SQL `LIKE` with `%` wildcards work, and how is it safely parameterized?

- **Answer:** The `LIKE` operator performs pattern matching against string data. The `%` wildcard character represents zero, one, or multiple arbitrary characters. To perform a safe case-insensitive substring match, the wildcard characters are wrapped around the user's search text inside the parameter value itself (e.g., `params.push(`%${search_q}%`)`), while the SQL statement maintains a clean placeholder (`WHERE title LIKE ?`). This ensures that special SQL characters inside the search text are treated as literal match data rather than executable SQL syntax.

### 4. How do `LIMIT` and `OFFSET` implement database pagination?

- **Answer:** 
  - **`LIMIT`** specifies the maximum number of rows the database engine will return in the result set for a single query.
  - **`OFFSET`** specifies the number of rows to skip before beginning to return rows.
  For page-based pagination where page numbering begins at 1 and each page displays $N$ items, the query translates to `LIMIT N OFFSET (page - 1) * N`. This prevents transferring massive datasets over the network and optimizes database memory usage.

### 5. Why does an invalid ID format return `400 Bad Request`, whereas a missing book returns `404 Not Found`?

- **Answer:** In REST architecture, HTTP status codes reflect the nature of the issue:
  - An invalid ID format (such as `/books/abc` or `/books/-5`) represents a syntactic client error where the request URI violates the contract of what constitutes a valid identifier; hence HTTP `400 Bad Request`.
  - Conversely, a well-formed ID that does not exist in the database (such as `/books/999`) represents a valid, understood request where the resource currently does not exist on the server; hence HTTP `404 Not Found`.

## Problems Faced and Solutions

1. **Windows PowerShell syntax incompatibility with SQL input redirection**:
   - *Problem:* Running `sqlite3 books.db < seed.sql` in PowerShell throws a parse error because `<` is reserved in PowerShell.
   - *Solution:* Documented and utilized the native SQLite CLI dot-command `sqlite3 books.db ".read seed.sql"`, which executes SQL script files natively on all platforms without shell redirection.

2. **Render deployment failure with unpinned native modules**:
   - *Problem:* Floating version ranges for native C/C++ addons like `sqlite3` can trigger source compilation attempts on Render's Linux build servers if prebuilt binaries are unavailable for newer minor releases.
   - *Solution:* Pinned `sqlite3` strictly to version `5.1.7` (`"sqlite3": "5.1.7"`), which reliably fetches pre-compiled Linux x64 binaries, ensuring rapid zero-compilation deployments on Render.

3. **Inconsistent error payload formats across routes**:
   - *Problem:* In Lab 2, error payloads returned `{ "error": "..." }`, while client specifications and testing suites require a standardized `{ "message": "..." }` shape across 400, 404, and 500 status codes.
   - *Solution:* Refactored all error response handlers, malformed JSON middleware, and unknown-route fallbacks to consistently emit `{ "message": "..." }`.

## Git and Repository Notes

- The `.gitignore` file in `Lab-03/` excludes `node_modules/`, `.env`, and local test runners.
- **Decision on `books.db`:** The pre-seeded `books.db` file is tracked in Git so evaluators and cloud deployment environments can start the server immediately without running external seed scripts.
- The repository maintains zero-secret compliance with no environment credentials or personal tokens checked into source control.
