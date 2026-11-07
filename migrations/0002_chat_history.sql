-- Chat history shared by the whole shift: no names are stored, only the text and when it was said.
CREATE TABLE chat_message (
    message_id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    order_id INTEGER REFERENCES customer_order(order_id),
    created_at_utc TEXT NOT NULL
);
CREATE INDEX chat_message_recent ON chat_message(created_at_utc);
CREATE INDEX chat_message_by_chat ON chat_message(chat_id, message_id);
CREATE INDEX chat_message_by_order ON chat_message(order_id);
