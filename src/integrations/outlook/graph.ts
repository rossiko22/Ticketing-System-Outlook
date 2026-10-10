export interface ApplicationGraphConfig {
    authMode?: 'application';
    tenantId: string;
    clientId: string;
    clientSecret: string;
    mailbox: string;
}

export interface AccessTokenGraphConfig {
    authMode: 'access_token';
    accessToken: string;
    mailbox: string;
    ownerEmail: string;
}

export type GraphConfig = ApplicationGraphConfig | AccessTokenGraphConfig;

export interface MailMessage {
    id: string;
    subject?: string;
    from?: { emailAddress?: { name?: string; address?: string } };
    bodyPreview?: string;
    body?: { contentType: string; content: string };
    receivedDateTime?: string;
    hasAttachments?: boolean;
    isRead?: boolean;
    "@removed"?: unknown;
}

export interface MailPage {
    value: MailMessage[];
    "@odata.nextLink"?: string;
    "@odata.deltaLink"?: string;
}

export class GraphError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export function createGraphClient(config: GraphConfig, request: typeof fetch = fetch) {
    let token: { value: string; expiresAt: number } | undefined;
    const path = config.authMode === 'access_token'
        ? '/v1.0/me/mailFolders/inbox/messages/delta'
        : `/v1.0/users/${encodeURIComponent(config.mailbox)}/mailFolders/inbox/messages/delta`;
    const initial = new URL(`https://graph.microsoft.com${path}`);
    initial.searchParams.set('$select', 'id,subject,from,bodyPreview,body,receivedDateTime,hasAttachments,isRead');

    async function accessToken() {
        if (config.authMode === 'access_token') return config.accessToken;
        if (token && token.expiresAt > Date.now() + 60_000) return token.value;
        const response = await request(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
            method: 'POST',
            body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
                grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }),
            signal: AbortSignal.timeout(30_000),
            redirect: 'error',
        });
        if (!response.ok) throw new GraphError(502, 'Microsoft authentication failed. Check the app credentials and tenant.');
        const data = await response.json() as { access_token?: string; expires_in?: number };
        if (!data.access_token || typeof data.expires_in !== 'number') throw new GraphError(502, 'Invalid Microsoft token response.');
        token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
        return token.value;
    }

    const expiredTokenMessage = 'The Outlook access token expired or was rejected. Save a fresh Graph Explorer token in Settings (or update GRAPH_ACCESS_TOKEN and restart if using environment configuration).';
    let verifiedAccountPath: string | undefined;

    async function verifyPersonalMailbox() {
        if (config.authMode !== 'access_token' || verifiedAccountPath) return;
        const response = await request('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName', {
            headers: { Authorization: `Bearer ${config.accessToken}` },
            signal: AbortSignal.timeout(30_000), redirect: 'error',
        });
        if (response.status === 401) throw new GraphError(502, expiredTokenMessage);
        if (response.status === 429) throw new GraphError(429, 'Microsoft is limiting requests. Wait before syncing again.');
        if (!response.ok) throw new GraphError(502, 'Could not verify the Outlook account. The Graph Explorer token needs delegated User.Read permission.');
        const profile = await response.json() as { id?: string; mail?: string; userPrincipalName?: string };
        const addresses = [profile.mail, profile.userPrincipalName].filter(value => typeof value === 'string').map(value => value!.toLowerCase());
        if (!profile.id || !addresses.includes(config.mailbox.toLowerCase())) {
            throw new GraphError(502, 'The token belongs to a different mailbox. Set GRAPH_MAILBOX to the mail or userPrincipalName returned by /me in Graph Explorer.');
        }
        verifiedAccountPath = `/v1.0/users/${encodeURIComponent(profile.id)}/mailFolders/inbox/messages/delta`;
    }

    async function page(cursor?: string | null): Promise<MailPage> {
        const url = new URL(cursor || initial.href);
        // A stored continuation URL must never send our bearer token to another host.
        if (url.origin !== initial.origin || url.username || url.password || url.hash) {
            throw new GraphError(502, 'Invalid Microsoft synchronization cursor.');
        }
        await verifyPersonalMailbox();
        if (![path, verifiedAccountPath].some(allowed => allowed && decodeURIComponent(url.pathname) === decodeURIComponent(allowed))) {
            throw new GraphError(502, 'Invalid Microsoft synchronization cursor.');
        }
        for (let attempt = 0; attempt < 2; attempt++) {
            const response = await request(url, {
                headers: { Authorization: `Bearer ${await accessToken()}`,
                    Prefer: 'outlook.body-content-type="text", IdType="ImmutableId", odata.maxpagesize=50' },
                signal: AbortSignal.timeout(30_000), redirect: 'error',
            });
            if (response.status === 401 && config.authMode === 'access_token') throw new GraphError(502, expiredTokenMessage);
            if (response.status === 401 && attempt === 0) { token = undefined; continue; }
            if (response.status === 410) throw new GraphError(410, 'Mailbox sync expired. Sync again to rebuild the checkpoint.');
            if (response.status === 429) throw new GraphError(429, 'Microsoft is limiting requests. Wait before syncing again.');
            if (!response.ok) throw new GraphError(502, `Microsoft mail request failed (${response.status}). Check mailbox access and Mail.Read permission.`);
            const data = await response.json() as MailPage;
            if (!Array.isArray(data.value) || !(data['@odata.nextLink'] || data['@odata.deltaLink'])) {
                throw new GraphError(502, 'Invalid Microsoft mail response.');
            }
            return data;
        }
        throw new GraphError(502, 'Microsoft authentication failed.');
    }
    async function send(id: string, action: 'reply' | 'forward', comment: string, recipients: string[]) {
        await verifyPersonalMailbox();
        const root = config.authMode === 'access_token' ? 'me' : `users/${encodeURIComponent(config.mailbox)}`;
        // Never automatically retry a send: a timeout may happen after Microsoft accepted it.
        const response = await request(`https://graph.microsoft.com/v1.0/${root}/messages/${encodeURIComponent(id)}/${action}`, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
            headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', Prefer: 'IdType="ImmutableId"' },
            body: JSON.stringify(action === 'reply' ? { comment } : { comment, toRecipients: recipients.map(address => ({ emailAddress: { address } })) }),
        });
        if (response.status === 401) { token = undefined; throw new GraphError(502, expiredTokenMessage); }
        if (response.status === 403) throw new GraphError(403, 'Microsoft denied sending. Consent to Mail.Send in Graph Explorer, then save the new token in Settings.');
        if (response.status === 404) throw new GraphError(404, 'The original email no longer exists in Outlook.');
        if (response.status === 429) throw new GraphError(429, 'Microsoft is limiting sending. Wait before trying again.');
        if (response.status >= 500) throw new Error('Microsoft sending result is uncertain.');
        if (response.status !== 202) throw new GraphError(502, `Microsoft did not accept the message (${response.status}).`);
    }
    return { page, send };
}
