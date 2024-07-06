import { promises as fs } from 'node:fs';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import createDoubleDb from '../src/index';

const testDir: string = './testData-' + Math.random();

test.after(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

async function prepareDatabase() {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  await db.insert({ id: 'id1', a: 'a' });
  await db.insert({ id: 'id2', a: 'b' });
  await db.insert({ id: 'id3', a: 'c' });
  await db.insert({ id: 'id4', a: 'd' });
  return db;
}

interface Record {
  id: string;
  a: string;
}

test('filter - top level key found by function - with skip', async (t: any) => {
  const db = await prepareDatabase();

  const filterRecords: Record[] = await db.filter('a', (v: string) => v >= 'c', { skip: 1 });

  await db.close();

  assert.deepEqual(filterRecords, [{
    id: 'id4',
    a: 'd'
  }]);
});

test('filter - top level key found by function - with limit', async (t: any) => {
  const db = await prepareDatabase();

  const filterRecords: Record[] = await db.filter('a', (v: string) => v >= 'a', { limit: 1 });

  await db.close();

  assert.deepEqual(filterRecords, [{
    id: 'id1',
    a: 'a'
  }]);
});

test('find - top level key found by function - returns document', async (t: any) => {
  const db = await prepareDatabase();

  const findRecord: Record | null = await db.find('a', (v: string) => v === 'b');

  await db.close();

  assert.deepEqual(findRecord, {
    id: 'id2',
    a: 'b'
  });
});

test('find - top level key found by function - with skip', async (t: any) => {
  const db = await prepareDatabase();

  const findRecord: Record | null = await db.find('a', (v: string) => v >= 'a', { skip: 1 });

  await db.close();

  assert.deepEqual(findRecord, {
    id: 'id2',
    a: 'b'
  });
});

test('find - top level key found by function - gt', async (t: any) => {
  const db = await prepareDatabase();

  const findRecord: Record | null = await db.find('a', (v: string) => v >= 'b', { gt: 'b' });

  await db.close();

  assert.deepEqual(findRecord, {
    id: 'id3',
    a: 'c'
  });
});

test('find - top level key found by function - lt', async (t: any) => {
  const db = await prepareDatabase();

  const findRecord: Record | null = await db.find('a', (v: string) => v >= 'a', { lt: 'b' });

  await db.close();

  assert.deepEqual(findRecord, {
    id: 'id1',
    a: 'a'
  });
});

test('find - top level key found by function - gte', async (t: any) => {
  const db = await prepareDatabase();

  const findRecord: Record | null = await db.find('a', (v: string) => v >= 'b', { gte: 'b' });

  await db.close();

  assert.deepEqual(findRecord, {
    id: 'id2',
    a: 'b'
  });
});

test('find - top level key found by function - lte', async (t: any) => {
  const db = await prepareDatabase();

  const findRecord: Record | null = await db.find('a', (v: string) => v >= 'a', { lte: 'b' });

  await db.close();

  assert.deepEqual(findRecord, {
    id: 'id1',
    a: 'a'
  });
});

test('find - top level key found by function - lte and gte', async (t: any) => {
  const db = await prepareDatabase();

  const findRecord: Record | null = await db.find('a', (v: string) => v === 'b', { gte: 'b', lte: 'b' });

  await db.close();

  assert.deepEqual(findRecord, {
    id: 'id2',
    a: 'b'
  });
});

test('find - top level key found by function - lt and gt', async (t: any) => {
  const db = await prepareDatabase();

  const findRecord: Record | null = await db.find('a', (v: string) => v > 'b', { gt: 'b', lt: 'd' });

  await db.close();

  assert.deepEqual(findRecord, {
    id: 'id3',
    a: 'c'
  });
});
