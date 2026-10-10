import type { Pool, PoolClient } from 'pg';
import { GraphError } from '../../integrations/outlook/graph.js';
import { defaultFilters, type MailFilters, type MailAccess } from './emails.types.js';
import type { MailMessage } from '../../integrations/outlook/graph.js';

export function createEmailRepository(pool: Pool) {
    async function save(client: PoolClient, mailbox: string, message: MailMessage) {
        // Keep imported records when Outlook deletes or moves a message out of Inbox.
        if (message['@removed']) return;
        if (!message.id) throw new Error('Microsoft message is missing its ID');
        await client.query(`INSERT INTO emails
            (mailbox, graph_id, subject, sender_name, sender_address, preview, body_text, received_at, has_attachments, is_read)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (mailbox, graph_id) DO UPDATE SET
            subject=EXCLUDED.subject, sender_name=EXCLUDED.sender_name, sender_address=EXCLUDED.sender_address,
            preview=EXCLUDED.preview, body_text=EXCLUDED.body_text, received_at=EXCLUDED.received_at,
            has_attachments=EXCLUDED.has_attachments, is_read=EXCLUDED.is_read`,
            [mailbox, message.id, message.subject ?? '', message.from?.emailAddress?.name ?? '',
                message.from?.emailAddress?.address ?? '', message.bodyPreview ?? '', message.body?.content ?? '',
                message.receivedDateTime ?? null, message.hasAttachments ?? false, message.isRead ?? false]);
    }
    const columns = `e.email_id AS id, e.subject, e.sender_name AS "senderName", e.sender_address AS "senderAddress",
        e.preview, e.received_at AS "receivedAt", e.has_attachments AS "hasAttachments", e.status, e.version,
        e.assigned_to AS "assignedTo", a.email AS "assigneeEmail", e.closed_by AS "closedBy", c.email AS "closedByEmail", e.closed_at AS "closedAt"`;
    const joins = 'LEFT JOIN users a ON a.user_id=e.assigned_to LEFT JOIN users c ON c.user_id=e.closed_by';
    async function list(mailbox: string, offset: number, filters: MailFilters = defaultFilters, access?: MailAccess) {
        const values = [mailbox, access?.manage === false ? access.userId : null, filters.status, filters.view,
            access?.userId ?? null, filters.assignee, filters.closedBy, filters.search, offset];
        const direction = filters.sort === 'oldest' ? 'ASC' : 'DESC';
        const result = await pool.query(`SELECT ${columns} FROM emails e ${joins} WHERE e.mailbox=$1
            AND ($2::uuid IS NULL OR e.assigned_to=$2)
            AND ($3='all' OR e.status=$3)
            AND ($4='all' OR ($4='assigned' AND e.assigned_to IS NOT NULL) OR ($4='mine' AND e.assigned_to=$5::uuid))
            AND ($6::uuid IS NULL OR e.assigned_to=$6) AND ($7::uuid IS NULL OR e.closed_by=$7)
            AND ($8='' OR strpos(lower(e.subject || ' ' || e.sender_name || ' ' || e.sender_address || ' ' || e.body_text), lower($8)) > 0)
            ORDER BY e.received_at ${direction} NULLS LAST, e.email_id LIMIT 51 OFFSET $9`, values);
        return { emails: result.rows.slice(0, 50), hasMore: result.rows.length > 50 };
    }
    async function get(mailbox: string, id: string, access?: MailAccess) {
        const result = await pool.query(`SELECT ${columns}, e.body_text AS body, e.graph_id AS "graphId"
            FROM emails e ${joins} WHERE e.mailbox=$1 AND e.email_id=$2 AND ($3::uuid IS NULL OR e.assigned_to=$3)`,
            [mailbox, id, access?.manage === false ? access.userId : null]);
        const email = result.rows[0];
        if (!email) return undefined;
        const activity = await pool.query(`SELECT t.description, t.created_at AS "createdAt", u.email AS actor
            FROM email_activity t JOIN users u ON u.user_id=t.actor_id WHERE t.email_id=$1 ORDER BY t.activity_id DESC`, [id]);
        const outgoing = await pool.query(`SELECT o.action,o.comment,o.recipients,o.state,o.created_at AS "createdAt",u.email AS actor
            FROM email_outgoing o JOIN users u ON u.user_id=o.actor_id WHERE o.email_id=$1 ORDER BY o.created_at DESC`, [id]);
        return { ...email, activity: activity.rows, outgoing: outgoing.rows };
    }
    async function metadata(mailbox: string, access: MailAccess) {
        const users = await pool.query('SELECT user_id AS id, email, is_active AS active FROM users ORDER BY email');
        const counts = await pool.query(`SELECT count(*)::int AS all,
            count(*) FILTER (WHERE status='unassigned')::int AS unassigned,
            count(*) FILTER (WHERE status='progress')::int AS progress,
            count(*) FILTER (WHERE status='finished')::int AS finished,
            count(*) FILTER (WHERE assigned_to IS NOT NULL)::int AS assigned,
            count(*) FILTER (WHERE assigned_to=$2)::int AS mine
            FROM emails WHERE mailbox=$1 AND ($3::boolean OR assigned_to=$2)`, [mailbox, access.userId, access.manage]);
        return { users: users.rows, counts: counts.rows[0] };
    }
    async function transition(mailbox: string, id: string, access: MailAccess, version: number, action: string, assignee?: string | null) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query('SELECT * FROM emails WHERE mailbox=$1 AND email_id=$2 FOR UPDATE', [mailbox, id]);
            const email = rows[0];
            if (!email || (!access.manage && email.assigned_to !== access.userId)) throw new GraphError(404, 'Email not found.');
            if (email.version !== version) throw new GraphError(409, 'This ticket changed. Refresh it before trying again.');
            let description: string;
            if (action === 'assign') {
                if (assignee) {
                    const target = await client.query('SELECT email FROM users WHERE user_id=$1 AND is_active=TRUE', [assignee]);
                    if (!target.rows[0]) throw new GraphError(400, 'Choose an active user.');
                    description = `Assigned to ${target.rows[0].email}`;
                } else description = 'Marked unassigned';
                await client.query(`UPDATE emails SET assigned_to=$2, status=$3, closed_by=NULL, closed_at=NULL, version=version+1 WHERE email_id=$1`,
                    [id, assignee ?? null, assignee ? 'progress' : 'unassigned']);
            } else if (action === 'finish') {
                if (email.assigned_to !== access.userId) throw new GraphError(403, 'Only the assigned user can finish this ticket.');
                if (email.status !== 'progress') throw new GraphError(409, 'Only an in-progress ticket can be finished.');
                await client.query("UPDATE emails SET status='finished',closed_by=$2,closed_at=NOW(),version=version+1 WHERE email_id=$1", [id, access.userId]);
                description = 'Finished ticket';
            } else {
                if (email.status !== 'finished') throw new GraphError(409, 'Only a finished ticket can be reopened.');
                await client.query("UPDATE emails SET status='progress',closed_by=NULL,closed_at=NULL,version=version+1 WHERE email_id=$1", [id]);
                description = 'Reopened ticket';
            }
            await client.query('INSERT INTO email_activity (email_id,actor_id,description) VALUES ($1,$2,$3)', [id, access.userId, description]);
            await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
    }
    async function reserveSend(id: string, access: MailAccess, requestId: string, action: string, comment: string, recipients: string[]) {
        const result = await pool.query(`INSERT INTO email_outgoing (request_id,email_id,actor_id,action,comment,recipients,state)
            VALUES ($1,$2,$3,$4,$5,$6,'pending') ON CONFLICT DO NOTHING RETURNING request_id`, [requestId,id,access.userId,action,comment,JSON.stringify(recipients)]);
        if (result.rowCount) return true;
        const { rows } = await pool.query('SELECT * FROM email_outgoing WHERE request_id=$1', [requestId]);
        const old = rows[0];
        if (old?.email_id === id && old.actor_id === access.userId && old.action === action && old.comment === comment && JSON.stringify(old.recipients) === JSON.stringify(recipients) && old.state === 'accepted') return false;
        throw new GraphError(409, 'This send request was already submitted. Check its history and Outlook Sent Items before sending again.');
    }
    async function sendState(requestId: string, state: string) {
        await pool.query('UPDATE email_outgoing SET state=$2 WHERE request_id=$1', [requestId, state]);
    }
    return { save, list, get, metadata, transition, reserveSend, sendState };
}
