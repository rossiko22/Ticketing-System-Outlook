import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graphConfig } from '../src/config/graph.js';

test('personal token config needs no app registration credentials', () => {
    assert.deepEqual(graphConfig({ GRAPH_AUTH_MODE: 'access_token', GRAPH_ACCESS_TOKEN: 'token',
        GRAPH_MAILBOX: 'Personal@Outlook.com', GRAPH_OWNER_EMAIL: 'Owner@Example.com' }), {
        authMode: 'access_token', accessToken: 'token', mailbox: 'personal@outlook.com', ownerEmail: 'owner@example.com',
    });
});

test('a supplied token selects personal mode even with leftover application settings', () => {
    const config = graphConfig({ GRAPH_ACCESS_TOKEN: 'token', GRAPH_MAILBOX: 'personal@outlook.com',
        GRAPH_OWNER_EMAIL: 'owner@example.com', GRAPH_TENANT_ID: 'unused', GRAPH_CLIENT_ID: 'unused' });
    assert.equal(config?.authMode, 'access_token');
});

test('personal mode requires an owner and rejects a Bearer-prefixed token', () => {
    assert.throws(() => graphConfig({ GRAPH_AUTH_MODE: 'access_token', GRAPH_ACCESS_TOKEN: 'token', GRAPH_MAILBOX: 'personal@outlook.com' }), /GRAPH_OWNER_EMAIL/);
    assert.throws(() => graphConfig({ GRAPH_AUTH_MODE: 'access_token', GRAPH_ACCESS_TOKEN: 'Bearer token', GRAPH_MAILBOX: 'personal@outlook.com', GRAPH_OWNER_EMAIL: 'owner@example.com' }), /without the Bearer prefix/);
});

test('empty settings disable Graph and invalid authentication modes fail clearly', () => {
    assert.equal(graphConfig({}), undefined);
    assert.throws(() => graphConfig({ GRAPH_AUTH_MODE: 'unknown' }), /GRAPH_AUTH_MODE/);
});
