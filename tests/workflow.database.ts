// Real PostgreSQL checks; synthetic users/mail and all changes roll back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { pool } from '../src/config/database.js';
import { createEmailRepository } from '../src/modules/emails/emails.repository.js';
import { createEmailService } from '../src/modules/emails/emails.service.js';
import { defaultFilters } from '../src/modules/emails/emails.types.js';
const client = await pool.connect();
try {
    await client.query('BEGIN');
    const mailbox = `workflow-${randomUUID()}@example.invalid`;
    const owner = randomUUID(); const teammate = randomUUID();
    for (const id of [owner,teammate]) await client.query("INSERT INTO users(user_id,email,password_hash,role,avatar_path) VALUES ($1,$2,'unused',1,'')",[id,`${id}@example.invalid`]);
    const adapter = { query: client.query.bind(client), connect: async () => ({
        query: (sql: string, values?: unknown[]) => client.query(sql === 'BEGIN' ? 'SAVEPOINT ticket_test' : sql === 'COMMIT' ? 'RELEASE SAVEPOINT ticket_test' : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT ticket_test' : sql, values),
        release() {},
    }) } as unknown as Pool;
    const repo = createEmailRepository(adapter);
    await repo.save(client,mailbox,{id:'older',subject:'VPN access',receivedDateTime:'2026-01-01T00:00:00Z'});
    await repo.save(client,mailbox,{id:'newer',subject:'Printer issue',receivedDateTime:'2026-02-01T00:00:00Z'});
    const manager = { userId: owner, manage: true }; const assignee = { userId: teammate, manage: false };
    const first = await repo.list(mailbox,0,defaultFilters,manager);
    assert.equal(first.emails[0].subject,'Printer issue');
    assert.equal((await repo.list(mailbox,0,{...defaultFilters,sort:'oldest'},manager)).emails[0].subject,'VPN access');
    assert.equal((await repo.list(mailbox,0,defaultFilters,assignee)).emails.length,0);
    const id = first.emails[0].id;
    await repo.transition(mailbox,id,manager,0,'assign',teammate);
    await assert.rejects(repo.transition(mailbox,id,manager,0,'assign',owner),/changed/);
    await assert.rejects(repo.transition(mailbox,id,manager,1,'finish'),/Only the assigned/);
    assert.equal((await repo.list(mailbox,0,{...defaultFilters,status:'progress',assignee:teammate},assignee)).emails.length,1);
    assert.equal((await repo.list(mailbox,0,{...defaultFilters,status:'unassigned'},manager)).emails.length,1);
    await repo.transition(mailbox,id,assignee,1,'finish');
    assert.equal((await repo.list(mailbox,0,{...defaultFilters,status:'finished',closedBy:teammate,search:'printer'},manager)).emails.length,1);
    assert.equal((await repo.list(mailbox,0,{...defaultFilters,status:'finished',closedBy:owner},manager)).emails.length,0);
    await repo.save(client,mailbox,{id:'newer',subject:'Printer updated'});
    assert.equal((await repo.get(mailbox,id,manager)).status,'finished');
    await repo.transition(mailbox,id,assignee,2,'reopen');
    assert.equal((await repo.get(mailbox,id,manager)).closedBy,null);
    let sends = 0;
    const service = createEmailService(adapter,repo,{page:async()=>({value:[]}),send:async()=>{sends++;}},mailbox);
    const requestId = randomUUID();
    await service.send(id,assignee,requestId,'reply','Test reply',[]);
    await service.send(id,assignee,requestId,'reply','Test reply',[]);
    assert.equal(sends,1);
    const uncertain = createEmailService(adapter,repo,{page:async()=>({value:[]}),send:async()=>{throw new Error('timeout');}},mailbox);
    const uncertainId = randomUUID();
    await assert.rejects(uncertain.send(id,assignee,uncertainId,'forward','Note',['test@example.invalid']),/uncertain/);
    await assert.rejects(uncertain.send(id,assignee,uncertainId,'forward','Note',['test@example.invalid']),/already submitted/);
    await repo.transition(mailbox,id,manager,3,'assign',owner);
    assert.equal(await repo.get(mailbox,id,assignee),undefined);
    assert.equal((await repo.metadata(mailbox,manager)).counts.progress,1);
    console.log('Workflow checks passed: assignment, ownership, concurrency, finish/reopen, filters, sorting, sync preservation, send deduplication and uncertain-send handling.');
} finally { await client.query('ROLLBACK'); client.release(); await pool.end(); }
