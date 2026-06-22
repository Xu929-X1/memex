CREATE TABLE session (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    token    TEXT    NOT NULL,
    saved_at BIGINT  NOT NULL
);
