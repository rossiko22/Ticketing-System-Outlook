import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { createOutlookConnection } from '../src/integrations/outlook/connection.js';
import { createGraphClient, type AccessTokenGraphConfig } from '../src/integrations/outlook/graph.js';

test('settings token is verified, encrypted, used immediately and survives a new connection instance', async () => {
    let saved: string | undefined;
    const used: string[] = [];
    const pool = { query: async (sql: string, values: string[]) => {
        if (sql.startsWith('INSERT')) { saved = values[1]; return { rows: [] }; }
        return { rows: saved ? [{ encrypted_token: saved, updated_at: '2026-01-01' }] : [] };
    } } as unknown as Pool;
    const config: AccessTokenGraphConfig = { authMode: 'access_token', accessToken: 'old-token', mailbox: 'me@outlook.com', ownerEmail: 'owner@example.com' };
    const factory: typeof createGraphClient = conf => ({
        page: async () => {
            const token = (conf as AccessTokenGraphConfig).accessToken;
            if (token === 'invalid-token') throw new Error('Invalid token');
            used.push(token); return { value: [], '@odata.deltaLink': 'next' };
        },
        send: async () => {},
    });
    const connection = createOutlookConnection(pool,config,'secret',factory);
    await connection.page();
    await connection.saveToken('new-token');
    assert.ok(saved && !saved.includes('new-token'));
    await connection.page();
    assert.equal(used.at(-1),'new-token');
    assert.deepEqual(await connection.status(),{mailbox:'me@outlook.com',mode:'access_token',source:'settings',updatedAt:'2026-01-01'});
    await assert.rejects(connection.saveToken('invalid-token'),/Invalid token/);
    const restarted = createOutlookConnection(pool,config,'secret',factory);
    await restarted.page(); assert.equal(used.at(-1),'new-token');
});
