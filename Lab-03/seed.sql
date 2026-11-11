CREATE TABLE IF NOT EXISTS book (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    price INTEGER NOT NULL,
    pages INTEGER NOT NULL
);

INSERT INTO book (id, title, author, price, pages) VALUES
(1, 'To Kill a Mockingbird', 'Harper Lee', 399, 281),
(2, '1984', 'George Orwell', 299, 328),
(3, 'The Great Gatsby', 'F. Scott Fitzgerald', 249, 180),
(4, 'Pride and Prejudice', 'Jane Austen', 199, 279),
(5, 'The Catcher in the Rye', 'J. D. Salinger', 349, 234),
(6, 'The Hobbit', 'J. R. R. Tolkien', 499, 310),
(7, 'Fahrenheit 451', 'Ray Bradbury', 299, 249),
(8, 'Brave New World', 'Aldous Huxley', 320, 268),
(9, 'Crime and Punishment', 'Fyodor Dostoevsky', 450, 671),
(10, 'The Alchemist', 'Paulo Coelho', 299, 208);
