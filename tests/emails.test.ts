import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool, PoolClient } from 'pg';
import { createEmailService } from '../src/modules/emails/emails.service.js';
import { GraphError } from '../src/integrations/outlook/graph.js';

function fixture(options: { locked?: boolean; failure?: Error; saveFailure?: boolean } = {}) {
    const queries: string[] = [];
    const saved: string[] = [];
    let released = false;
    const client = {
        query: async (sql: string) => {
            queries.push(sql);
            return { rows: sql.includes('pg_try') ? [{ locked: options.locked ?? true }] : [{ cursor: 'checkpoint' }] };
        },
        release: () => { released = true; },
    } as unknown as PoolClient;
    const pool = { connect: async () => client } as unknown as Pool;
    const graph = { page: async (cursor?: string | null) => {
        assert.equal(cursor, 'checkpoint');
        if (options.failure) throw options.failure;
        return { value: [{ id: 'mail' }], '@odata.nextLink': 'next' };
    } };
    const repository = {
        save: async (_client: PoolClient, _mailbox: string, message: { id: string }) => {
            if (options.saveFailure) throw new Error('storage unavailable');
            saved.push(message.id);
        },
        list: async () => ({ emails: [], hasMore: false }),
        get: async () => undefined,
    };
    return { service: createEmailService(pool, repository, graph, 'support@example.com'), queries, saved, released: () => released };
}

test('saves a page and checkpoint together, then releases connection', async () => {
    const f = fixture();
    assert.deepEqual(await f.service.sync(), { processed: 1, hasMore: true });
    assert.deepEqual(f.saved, ['mail']);
    assert.equal(f.queries.at(-1), 'COMMIT');
    assert.equal(f.released(), true);
});
test('storage failure rolls back without advancing checkpoint', async () => {
    const f = fixture({ saveFailure: true });
    await assert.rejects(f.service.sync(), /storage unavailable/);
    assert.equal(f.queries.some(sql => sql.startsWith('UPDATE')), false);
    assert.equal(f.queries.at(-1), 'ROLLBACK');
    assert.equal(f.released(), true);
});
test('concurrent import is rejected', async () => {
    const f = fixture({ locked: false });
    await assert.rejects(f.service.sync(), error => error instanceof GraphError && error.status === 409);
    assert.deepEqual(f.saved, []);
});
test('expired delta checkpoint is cleared and committed for a fresh import', async () => {
    const f = fixture({ failure: new GraphError(410, 'expired') });
    await assert.rejects(f.service.sync(), /expired/);
    assert.ok(f.queries.some(sql => sql.includes('SET cursor=NULL')));
    assert.ok(f.queries.includes('COMMIT'));
});
