import 'dotenv/config';
import type { GraphConfig } from '../integrations/outlook/graph.js';

export function graphConfig(settings: NodeJS.ProcessEnv = process.env): GraphConfig | undefined {
    const mode = settings.GRAPH_AUTH_MODE?.trim() || (settings.GRAPH_ACCESS_TOKEN?.trim() ? 'access_token' : 'application');
    if (mode !== 'application' && mode !== 'access_token') throw new Error('GRAPH_AUTH_MODE must be application or access_token');
    if (mode === 'access_token') {
        const accessToken = settings.GRAPH_ACCESS_TOKEN?.trim();
        const mailbox = settings.GRAPH_MAILBOX?.trim().toLowerCase();
        const ownerEmail = settings.GRAPH_OWNER_EMAIL?.trim().toLowerCase();
        if (!accessToken || !mailbox || !ownerEmail) {
            throw new Error('Access-token mode requires GRAPH_ACCESS_TOKEN, GRAPH_MAILBOX and GRAPH_OWNER_EMAIL (your ticketing app login email).');
        }
        if (/\s/.test(accessToken)) throw new Error('GRAPH_ACCESS_TOKEN must contain only the token, without the Bearer prefix.');
        return { authMode: 'access_token', accessToken, mailbox, ownerEmail };
    }
    const keys = ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_MAILBOX'] as const;
    const values = keys.map(key => settings[key]?.trim());
    if (values.every(value => !value)) return undefined;
    if (values.some(value => !value)) throw new Error(`Configure all of: ${keys.join(', ')}`);
    return { tenantId: values[0]!, clientId: values[1]!, clientSecret: values[2]!, mailbox: values[3]!.toLowerCase() };
}
