import { promises as fs } from 'fs';
import test from 'basictap';
import createDoubleDb from '../index.js';

async function prepareDatabase () {
  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');
  await db.insert({ id: 'id1', a: 'a' });
  await db.insert({ id: 'id2', a: 'b' });
  await db.insert({ id: 'id3', a: 'c' });
  await db.insert({ id: 'id4', a: 'd' });
  return db;
}

test('filter - top level key found by function - with skip', async t => {
  t.plan(1);

  const db = await prepareDatabase();

  const filterRecords = await db.filter('a', v => v >= 'c', { skip: 1 });

  await db.close();

  t.deepEqual(filterRecords, [{
    id: 'id4',
    a: 'd'
  }]);
});

test('filter - top level key found by function - with limit', async t => {
  t.plan(1);

  const db = await prepareDatabase();

  const filterRecords = await db.filter('a', v => v >= 'a', { limit: 1 });

  await db.close();

  t.deepEqual(filterRecords, [{
    id: 'id1',
    a: 'a'
  }]);
});

test('find - top level key found by function - returns document', async t => {
  t.plan(1);

  const db = await prepareDatabase();

  const findRecord = await db.find('a', v => v === 'b');

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id2',
    a: 'b'
  });
});

test('find - top level key found by function - with skip', async t => {
  t.plan(1);

  const db = await prepareDatabase();

  const findRecord = await db.find('a', v => v >= 'a', { skip: 1 });

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id2',
    a: 'b'
  });
});

test('find - top level key found by function - gt', async t => {
  t.plan(1);

  const db = await prepareDatabase();

  const findRecord = await db.find('a', v => v >= 'b', { gt: 'b' });

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id3',
    a: 'c'
  });
});

test('find - top level key found by function - lt', async t => {
  t.plan(1);

  const db = await prepareDatabase();

  const findRecord = await db.find('a', v => v >= 'a', { lt: 'b' });

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id1',
    a: 'a'
  });
});

test('find - top level key found by function - gte', async t => {
  t.plan(1);

  const db = await prepareDatabase();

  const findRecord = await db.find('a', v => v >= 'b', { gte: 'b' });

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id2',
    a: 'b'
  });
});

test('find - top level key found by function - lte', async t => {
  t.plan(1);

  const db = await prepareDatabase();

  const findRecord = await db.find('a', v => v >= 'a', { lte: 'b' });

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id1',
    a: 'a'
  });
});

test('find - top level key found by function - lte and gte', async t => {
  t.plan(1);

  const db = await prepareDatabase();

  const findRecord = await db.find('a', v => v === 'b', { gte: 'b', lte: 'b' });

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id2',
    a: 'b'
  });
});

test('find - top level key found by function - lt and gt', async t => {
  t.plan(1);

  const db = await prepareDatabase();

  const findRecord = await db.find('a', v => v > 'b', { gt: 'b', lt: 'd' });

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id3',
    a: 'c'
  });
});
