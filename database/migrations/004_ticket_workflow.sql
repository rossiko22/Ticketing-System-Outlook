-- Up Migration
ALTER TABLE emails
    ADD COLUMN status TEXT NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned','progress','finished')),
    ADD COLUMN assigned_to UUID REFERENCES users(user_id),
    ADD COLUMN closed_by UUID REFERENCES users(user_id),
    ADD COLUMN closed_at TIMESTAMPTZ,
    ADD COLUMN version INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT email_assignment_state CHECK (
        (status='unassigned' AND assigned_to IS NULL AND closed_by IS NULL AND closed_at IS NULL) OR
        (status='progress' AND assigned_to IS NOT NULL AND closed_by IS NULL AND closed_at IS NULL) OR
        (status='finished' AND assigned_to IS NOT NULL AND closed_by IS NOT NULL AND closed_at IS NOT NULL)
    );
CREATE INDEX emails_workflow ON emails(mailbox, status, assigned_to);
CREATE TABLE email_activity (
    activity_id BIGSERIAL PRIMARY KEY,
    email_id UUID NOT NULL REFERENCES emails(email_id),
    actor_id UUID NOT NULL REFERENCES users(user_id),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE email_outgoing (
    request_id UUID PRIMARY KEY,
    email_id UUID NOT NULL REFERENCES emails(email_id),
    actor_id UUID NOT NULL REFERENCES users(user_id),
    action TEXT NOT NULL CHECK (action IN ('reply','forward')),
    comment TEXT NOT NULL,
    recipients JSONB NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('pending','accepted','failed','unknown')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE outlook_connections (
    mailbox TEXT PRIMARY KEY,
    encrypted_token TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Down Migration
DROP TABLE outlook_connections;
DROP TABLE email_outgoing;
DROP TABLE email_activity;
ALTER TABLE emails DROP CONSTRAINT email_assignment_state,
    DROP COLUMN status, DROP COLUMN assigned_to, DROP COLUMN closed_by, DROP COLUMN closed_at, DROP COLUMN version;
