// Read-only regression check for the lookup used by authenticated API routes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/config/database.js';
import { findById } from '../src/modules/users/users.repository.js';

try {
    const { rows } = await pool.query<{ user_id: ReturnType<typeof randomUUID> }>('SELECT user_id FROM users LIMIT 1');
    if (rows[0]) {
        const user = await findById(rows[0].user_id);
        assert.equal(user?.userId, rows[0].user_id);
    }
    assert.equal(await findById(randomUUID()), null);
    console.log('PostgreSQL authenticated user lookup passed.');
} finally {
    await pool.end();
}
