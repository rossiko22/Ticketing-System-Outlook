-- Up Migration
CREATE TABLE mailbox_sync (
    mailbox TEXT PRIMARY KEY,
    cursor TEXT,
    synced_at TIMESTAMPTZ
);

CREATE TABLE emails (
    email_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox TEXT NOT NULL,
    graph_id TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    sender_name TEXT NOT NULL DEFAULT '',
    sender_address TEXT NOT NULL DEFAULT '',
    preview TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '',
    received_at TIMESTAMPTZ,
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (mailbox, graph_id)
);
CREATE INDEX emails_mailbox_received ON emails (mailbox, received_at DESC, email_id);

-- Down Migration
DROP TABLE emails;
DROP TABLE mailbox_sync;
