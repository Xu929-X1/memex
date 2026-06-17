CREATE TABLE session (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    token    TEXT    NOT NULL,
    saved_at BIGINT  NOT NULL
);

CREATE TABLE user_info (
    id       TEXT PRIMARY KEY NOT NULL,
    email    TEXT NOT NULL,
    username TEXT
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);
