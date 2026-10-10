import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import type { createAuthMiddleware } from '../src/middleware/auth.middleware.js';
import type { createEmailService } from '../src/modules/emails/emails.service.js';
import { createEmailRouter } from '../src/modules/emails/emails.routes.js';
const userId = '00000000-0000-0000-0000-000000000001';
const auth = { requireAuth: (_req, _res, next) => next() } as ReturnType<typeof createAuthMiddleware>;
async function request(method: string, url: string, service: Partial<ReturnType<typeof createEmailService>>) {
    let status = 200; let body: unknown;
    const router = createEmailRouter(auth, service as ReturnType<typeof createEmailService>, 'owner@example.com');
    await new Promise<void>((resolve, reject) => {
        const req = { method, url, query: {}, headers: {}, is: () => true, get: () => 'same-origin', currentUser: { userId, email: 'teammate@example.com' } } as unknown as Request;
        const res = { set() { return this; }, status(code: number) { status = code; return this; }, json(value: unknown) { body = value; resolve(); } } as unknown as Response;
        router(req, res, reject);
    });
    return { status, body };
}
test('teammates list only their assigned emails through scoped service access', async () => {
    const result = await request('GET', '/', { list: async (_offset, _filters, access) => {
        assert.deepEqual(access, { userId, manage: false }); return { emails: [], hasMore: false };
    } });
    assert.equal(result.status, 200);
});
test('teammate detail lookup is scoped and returns 404 for inaccessible mail', async () => {
    const result = await request('GET', `/${userId}`, { get: async (_id, access) => {
        assert.deepEqual(access, { userId, manage: false }); return undefined;
    } });
    assert.equal(result.status, 404);
});
for (const [method,url] of [['POST','/sync'],['GET','/connection'],['PUT','/connection/token']]) {
    test(`teammates cannot manage mailbox: ${method} ${url}`, async () => {
        const result = await request(method!, url!, { sync: async () => { throw new Error('must not sync'); } });
        assert.equal(result.status, 403);
    });
}
