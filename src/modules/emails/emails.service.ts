import type { Pool } from 'pg';
import { GraphError, type createGraphClient } from '../../integrations/outlook/graph.js';
import type { createEmailRepository } from './emails.repository.js';
import type { MailAccess, MailFilters } from './emails.types.js';

export function createEmailService(pool: Pool, repository: ReturnType<typeof createEmailRepository>,
    graph: Pick<ReturnType<typeof createGraphClient>, 'page'> & Partial<Pick<ReturnType<typeof createGraphClient>, 'send'>>, mailbox: string) {
    async function sync() {
        const client = await pool.connect();
        let transactionActive = false;
        try {
            await client.query('BEGIN');
            transactionActive = true;
            // Transaction-scoped lock prevents concurrent syncs across server processes.
            const lock = await client.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked', [`mail-sync:${mailbox}`]);
            if (!lock.rows[0].locked) throw new GraphError(409, 'Mailbox synchronization is already running.');
            await client.query('INSERT INTO mailbox_sync (mailbox) VALUES ($1) ON CONFLICT DO NOTHING', [mailbox]);
            const state = await client.query('SELECT cursor FROM mailbox_sync WHERE mailbox=$1', [mailbox]);
            let page;
            try { page = await graph.page(state.rows[0].cursor); }
            catch (error) {
                if (!(error instanceof GraphError) || error.status !== 410) throw error;
                await client.query('UPDATE mailbox_sync SET cursor=NULL WHERE mailbox=$1', [mailbox]);
                await client.query('COMMIT');
                transactionActive = false;
                throw error;
            }
            for (const message of page.value) await repository.save(client, mailbox, message);
            await client.query('UPDATE mailbox_sync SET cursor=$2, synced_at=NOW() WHERE mailbox=$1',
                [mailbox, page['@odata.nextLink'] || page['@odata.deltaLink']]);
            await client.query('COMMIT');
            transactionActive = false;
            return { processed: page.value.filter(message => !message['@removed']).length, hasMore: Boolean(page['@odata.nextLink']) };
        } catch (error) {
            if (transactionActive) await client.query('ROLLBACK');
            throw error;
        } finally { client.release(); }
    }
    async function send(id: string, access: MailAccess, requestId: string, action: 'reply' | 'forward', comment: string, recipients: string[]) {
        const email = await repository.get(mailbox, id, access);
        if (!email) throw new GraphError(404, 'Email not found.');
        if (!graph.send) throw new GraphError(503, 'Sending is not configured.');
        if (!await repository.reserveSend(id, access, requestId, action, comment, recipients)) return { accepted: true };
        try { await graph.send(email.graphId, action, comment, recipients); }
        catch (error) {
            await repository.sendState(requestId, error instanceof GraphError ? 'failed' : 'unknown');
            if (error instanceof GraphError) throw error;
            throw new GraphError(502, 'Sending result is uncertain. Check Outlook Sent Items before trying again to avoid a duplicate.');
        }
        try { await repository.sendState(requestId, 'accepted'); }
        catch { throw new GraphError(502, 'Outlook accepted the message, but its history could not be updated. Check Sent Items; do not resend.'); }
        return { accepted: true };
    }
    return { sync, send,
        list: (offset: number, filters?: MailFilters, access?: MailAccess) => repository.list(mailbox, offset, filters, access),
        get: (id: string, access?: MailAccess) => repository.get(mailbox, id, access),
        metadata: (access: MailAccess) => repository.metadata(mailbox, access),
        transition: (id: string, access: MailAccess, version: number, action: string, assignee?: string | null) => repository.transition(mailbox, id, access, version, action, assignee) };
}
