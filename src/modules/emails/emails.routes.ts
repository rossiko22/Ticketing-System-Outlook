import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { createAuthMiddleware } from '../../middleware/auth.middleware.js';
import type { createEmailService } from './emails.service.js';
import type { createOutlookConnection } from '../../integrations/outlook/connection.js';
import { GraphError } from '../../integrations/outlook/graph.js';
import type { MailAccess, MailFilters } from './emails.types.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createEmailRouter(auth: ReturnType<typeof createAuthMiddleware>, service?: ReturnType<typeof createEmailService>, ownerEmail?: string, connection?: ReturnType<typeof createOutlookConnection>) {
    const router = Router();
    const access = (req: Request): MailAccess => ({ userId: req.currentUser!.userId,
        manage: !ownerEmail || req.currentUser!.email.toLowerCase() === ownerEmail.toLowerCase() });
    router.use(auth.requireAuth);
    router.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (!service) { res.status(503).json({ message: 'Outlook is not configured. Add the GRAPH_* settings to the server environment.' }); return; }
        if (!['GET','HEAD'].includes(req.method) && (!req.is('application/json') || req.get('Sec-Fetch-Site') === 'cross-site')) {
            res.status(415).json({ message: 'Use a same-site application/json request.' }); return;
        }
        next();
    });
    function manager(req: Request) {
        if (!access(req).manage) throw new GraphError(403, 'Only the mailbox owner can manage its connection or sync mail.');
    }
    router.get('/meta', async (req, res) => {
        const scope = access(req);
        res.json({ ...await service!.metadata(scope), canManage: scope.manage, currentUser: req.currentUser });
    });
    router.get('/connection', async (req, res) => {
        manager(req);
        if (!connection) throw new GraphError(503, 'Outlook settings unavailable.');
        res.json(await connection.status());
    });
    router.put('/connection/token', async (req, res) => {
        manager(req);
        if (!connection) throw new GraphError(503, 'Outlook settings unavailable.');
        if (typeof req.body?.token !== 'string') throw new GraphError(400, 'An access token is required.');
        await connection.saveToken(req.body.token.trim());
        res.json({ message: 'Token verified and saved. You can sync now; no restart is needed.' });
    });
    router.get('/', async (req, res) => {
        const q = req.query;
        const offset = Number(q.offset ?? 0);
        const status = q.status ?? 'all'; const view = q.view ?? 'all'; const sort = q.sort ?? 'newest';
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000 ||
            typeof status !== 'string' || !['all','unassigned','progress','finished'].includes(status) || typeof view !== 'string' || !['all','assigned','mine'].includes(view) ||
            typeof sort !== 'string' || !['newest','oldest'].includes(sort) || (q.search !== undefined && (typeof q.search !== 'string' || q.search.length > 200)) ||
            [q.assignee,q.closedBy].some(value => value !== undefined && (typeof value !== 'string' || !uuid.test(value)))) {
            throw new GraphError(400, 'Invalid mailbox filters.');
        }
        const filters: MailFilters = { offset, status: status as MailFilters['status'], view: view as MailFilters['view'], sort: sort as MailFilters['sort'],
            search: String(q.search ?? ''), assignee: q.assignee ? String(q.assignee) : null, closedBy: q.closedBy ? String(q.closedBy) : null };
        res.json(await service!.list(offset, filters, access(req)));
    });
    router.post('/sync', async (req, res) => { manager(req); res.json(await service!.sync()); });
    router.param('id', (_req, _res, next, id) => { next(uuid.test(id) ? undefined : new GraphError(400, 'Invalid email ID.')); });
    router.get('/:id', async (req, res) => {
        const email = await service!.get(String(req.params.id), access(req));
        if (!email) throw new GraphError(404, 'Email not found.');
        const { graphId, ...safe } = email;
        res.json({ email: safe });
    });
    router.patch('/:id/ticket', async (req, res) => {
        const { action, version, assignee } = req.body ?? {};
        if (!['assign','finish','reopen'].includes(action) || !Number.isSafeInteger(version) || version < 0 ||
            (action === 'assign' && assignee !== null && (typeof assignee !== 'string' || !uuid.test(assignee)))) {
            throw new GraphError(400, 'Provide a valid ticket action, version and assignee.');
        }
        await service!.transition(String(req.params.id), access(req), version, action, assignee);
        res.json({ updated: true });
    });
    router.post('/:id/send', async (req, res) => {
        const { action, requestId, comment, recipients = [] } = req.body ?? {};
        if (!['reply','forward'].includes(action) || typeof requestId !== 'string' || !uuid.test(requestId) ||
            typeof comment !== 'string' || comment.length > 20000 || (action === 'reply' && !comment.trim()) ||
            !Array.isArray(recipients) || recipients.length > 20 || (action === 'forward' && !recipients.length) ||
            (action === 'reply' && recipients.length) || recipients.some(value => typeof value !== 'string' || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value))) {
            throw new GraphError(400, 'Enter a message and valid recipient email addresses (maximum 20).');
        }
        res.status(202).json(await service!.send(String(req.params.id), access(req), requestId, action, comment, recipients));
    });
    router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (error instanceof GraphError) { res.status(error.status).json({ message: error.message }); return; }
        next(error);
    });
    return router;
}
