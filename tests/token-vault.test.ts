import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenVault } from '../src/integrations/outlook/connection.js';
test('saved tokens are encrypted, bound to the mailbox and authenticated', () => {
    const vault = tokenVault('server-secret','personal@outlook.com');
    const sealed = vault.encrypt('opaque-access-token');
    assert.equal(sealed.includes('opaque-access-token'), false);
    assert.equal(vault.decrypt(sealed), 'opaque-access-token');
    assert.notEqual(vault.encrypt('opaque-access-token'), sealed);
    assert.throws(() => tokenVault('other-secret','personal@outlook.com').decrypt(sealed));
    assert.throws(() => tokenVault('server-secret','other@outlook.com').decrypt(sealed));
});
