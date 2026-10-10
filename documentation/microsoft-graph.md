# Receive Outlook mail through Microsoft Graph

The **All emails** page (`app.html`) imports and displays one Outlook mailbox: either your personal account using a Graph Explorer token, or a Microsoft 365 support mailbox using application credentials. Click **Sync Outlook** to import Inbox messages. It saves messages in PostgreSQL and remembers a delta checkpoint; later syncs fetch changes rather than duplicating messages. This is manual synchronization, not a background poller or webhook subscription.

## Personal Outlook: use your Graph Explorer token

1. Sign into [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) with your personal Outlook account. Consent to delegated **Mail.Read** and **User.Read**.
2. Run `GET https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName`. Use the returned `mail` (or `userPrincipalName`) for `GRAPH_MAILBOX`.
3. Copy the token from Graph Explorer's **Access token** tab into your local server `.env` (not `.env-example` or browser JavaScript):

   ```dotenv
   GRAPH_AUTH_MODE=access_token
   GRAPH_ACCESS_TOKEN=paste-the-access-token-without-the-Bearer-prefix
   GRAPH_MAILBOX=your-personal-address@outlook.com
   GRAPH_OWNER_EMAIL=your-login-email-in-this-ticketing-app
   ```

4. Start the backend with `npm run "start backend"`, sign into the ticketing app as `GRAPH_OWNER_EMAIL`, and click **Sync Outlook** on **All emails**. This development command watches `.env` and restarts when you save a new token. If the backend was already running before this watch option was added, stop it and run the command again once. Other launch commands still require a manual restart after editing `.env`.

This mode needs no tenant ID, client ID, client secret, or administrator consent. Existing application-mode credentials are ignored. Only the specified app user can read or sync your personal mail. Before importing, the server verifies that the token's account matches `GRAPH_MAILBOX`, preventing a token for another account from mixing mail into the existing records.

The token is sent server-side to Microsoft Graph and is never returned to the browser. A copied access token is temporary: when it expires, replace `GRAPH_ACCESS_TOKEN` with a fresh token and restart. Existing imported emails and the sync checkpoint remain available. Automatic renewal would require a separate Microsoft sign-in integration with an app registration supporting personal accounts, delegated `Mail.Read`/`User.Read` and `offline_access`; this copied-token mode cannot renew Graph Explorer's token.

## Microsoft 365 organization: application credentials

1. In Microsoft Entra admin center, create a single-tenant app registration for your organization. Copy the Directory (tenant) ID and Application (client) ID.
2. Under **API permissions**, add **Microsoft Graph → Application permissions → Mail.Read** and have your tenant administrator grant consent. Application access requires a work/school Microsoft 365 tenant, not a personal Outlook.com account.
3. Create a client secret and put its **value** in the server's `.env`. Keep the secret out of browser code and version control. Rotate it before expiration.
4. Set these four values (leave all four empty to disable the integration):

   ```dotenv
   GRAPH_AUTH_MODE=application
   GRAPH_TENANT_ID=your-directory-tenant-id
   GRAPH_CLIENT_ID=your-application-client-id
   GRAPH_CLIENT_SECRET=your-secret-value
   GRAPH_MAILBOX=support@your-organization.com
   ```

`Mail.Read` application consent can grant access across the tenant. Have the Exchange administrator restrict the app to the intended support mailbox using the organization's supported Exchange access controls. Setting `GRAPH_MAILBOX` chooses which mailbox this app imports; it does not restrict the Microsoft permission itself.

In application mode, all active users of this ticketing application can read and sync the shared mailbox through the authenticated API.

## Run

With the existing PostgreSQL and session variables configured:

```sh
npm run migration
npm run "start backend"
```

Sign in at `http://localhost:3000`, open **All emails**, and click **Sync Outlook**. A large initial import runs up to 20 pages per click; click again if asked to continue. Imported mail survives Outlook moves/deletions. The checkpoint and each page's database updates commit together, so a failed page can be retried.

## Graph Explorer

[Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) is a separate API testing application. Sign in, consent to delegated `Mail.Read`, and try:

```http
GET https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=10
```

That tests the signed-in user's Inbox. In access-token mode, this server uses the same delegated token with `/me/mailFolders/inbox/messages/delta`. In application mode, it uses its own app credentials with `/users/{GRAPH_MAILBOX}/mailFolders/inbox/messages/delta`; `/me` is unavailable with app-only authentication.

## API and current scope

- `GET /emails?offset=0`: up to 50 stored emails and `hasMore`.
- `GET /emails/:id`: one stored email, including its body.
- `POST /emails/sync`: imports one Graph page; send `Content-Type: application/json` and `{}`. Returns `processed` and `hasMore`.

All endpoints require an existing application session. Responses are not cacheable. Message bodies render as text, including any unexpected HTML returned by Microsoft.

The main mailbox page is live; the other assignment/status pages remain design previews. Attachments are indicated but not downloaded. Sending replies, ticket assignments, completion, and exports are not part of this integration.

Missing settings return 503; overlapping syncs return 409. If Microsoft expires a checkpoint, the first request returns 410 and clears it; click sync again. A 429 means wait before retrying. In personal mode, a rejected/expired token produces a message asking you to replace it and restart; it does not sign you out of the ticketing app. In application mode, authentication/permission errors require checking the tenant, secret, admin consent and mailbox access. Application tokens refresh automatically; copied Graph Explorer tokens do not.

## Verification

Use Node.js 24+ for `npm test`, which exercises Graph authentication, continuation handling, errors and transactional sync behavior without Microsoft credentials. Run `npx tsc --noEmit` for TypeScript checks. Live Microsoft verification requires your configured tenant and mailbox.

After applying the migration, `node --import tsx tests/emails.database.ts` checks duplicate updates and retained records against your configured local PostgreSQL database. Its test records are rolled back.

References: [client credentials](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow), [mail delta](https://learn.microsoft.com/en-us/graph/api/message-delta?view=graph-rest-1.0), [list messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0).
