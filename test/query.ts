import { promises as fs } from 'fs';
import test from 'node:test';
import { strict as assert } from 'node:assert';
import createDoubleDb from '../src/index';

const testDir = './testData-' + Math.random();

test.after(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

async function setupTestDb() {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  return db;
}

test('empty query', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 'alpha' });
  await db.insert({ value: 'beta' });
  const result = await db.query({});
  assert.strictEqual(result.length, 2);
  result.sort((a, b) => a.value < b.value ? -1 : 1);
  assert.strictEqual(result[0].value, 'alpha');
  assert.strictEqual(result[1].value, 'beta');
  await db.close();
});

test('special characters', async () => {
  const db = await setupTestDb();
  await db.insert({ id: 'users/mark', name: 'Mark' });
  await db.insert({ id: 'users/joe', name: 'Joe' });
  await db.insert({ id: 'users/mary', name: 'Mary' });
  await db.insert({ id: 'groups/standard', name: 'Standard' });
  await db.insert({ id: 'groups/admin', name: 'Admin' });
  await db.insert({ id: 'rootD', name: 'rootD' });

  const result = await db.query();
  assert.strictEqual(result.length, 6);
  await db.close();
});

test('$sw operator on string', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 'alpha' });
  await db.insert({ value: 'beta' });
  await db.insert({ value: 'chi' });
  const result = await db.query({ value: { $sw: 'b' } });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].value, 'beta');
  await db.close();
});

test('$eq operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 5 });
  await db.insert({ value: 10 });
  const result = await db.query({ value: { $eq: 5 } });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].value, 5);
  await db.close();
});

test('$ne operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 5 });
  await db.insert({ value: 10 });
  const result = await db.query({ value: { $ne: 5 } });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].value, 10);
  await db.close();
});

test('$gt operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 5 });
  await db.insert({ value: 10 });
  const result = await db.query({ value: { $gt: 7 } });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].value, 10);
  await db.close();
});

test('$gte operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 5 });
  await db.insert({ value: 10 });
  const result = await db.query({ value: { $gte: 5 } });
  assert.strictEqual(result.length, 2);
  await db.close();
});

test('$lt operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 5 });
  await db.insert({ value: 10 });
  const result = await db.query({ value: { $lt: 7 } });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].value, 5);
  await db.close();
});

test('$lte operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 5 });
  await db.insert({ value: 10 });
  const result = await db.query({ value: { $lte: 10 } });
  assert.strictEqual(result.length, 2);
  await db.close();
});

test('$in operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 5 });
  await db.insert({ value: 10 });
  const result = await db.query({ value: { $in: [5, 15] } });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].value, 5);
  await db.close();
});

test('$nin operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 5 });
  await db.insert({ value: 10 });
  const result = await db.query({ value: { $nin: [5, 15] } });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].value, 10);
  await db.close();
});

test('$exists operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 5 });
  await db.insert({ another: 10 });
  const result = await db.query({ value: { $exists: true } });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].value, 5);
  await db.close();
});

test('$all operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: [1, 2, 3] });
  await db.insert({ value: [1, 2] });
  const result = await db.query({ value: { $all: [1, 2, 3] } });
  assert.strictEqual(result.length, 1);
  assert.deepStrictEqual(result[0].value, [1, 2, 3]);
  await db.close();
});

test('$not operator', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 5 });
  await db.insert({ value: 10 });
  const result = await db.query({ value: { $not: { $gt: 7 } } });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].value, 5);
  await db.close();
});

test('Complex query with $or', async () => {
  const db = await setupTestDb();
  await db.insert({ category: 'a', firstName: 'Joe' });
  await db.insert({ category: 'b', firstName: 'Nope' });
  await db.insert({ category: 'b', firstName: 'Joe' });
  const result = await db.query({
    category: 'b',
    $or: [
      { firstName: { $eq: 'Joe' } },
      { firstName: { $eq: 'joe' } }
    ]
  });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].firstName, 'Joe');
  assert.strictEqual(result[0].category, 'b');
  await db.close();
});

test('query limit, offset, sort', async () => {
  const db = await setupTestDb();
  for (let i = 0; i < 10; i++) {
    await db.insert({ value: i });
  }
  const result = await db.query({}, {
    limit: 3,
    offset: 2,
    sort: {
      value: 1
    }
  });
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].value, 2);
  assert.strictEqual(result[1].value, 3);
  assert.strictEqual(result[2].value, 4);

  await db.close();
});

test('query sort with nested fields', async () => {
  const db = await setupTestDb();
  await db.insert({ value: { category: 2, name: 'B' } });
  await db.insert({ value: { category: 1, name: 'A' } });
  await db.insert({ value: { category: 1, name: 'C' } });
  await db.insert({ value: { category: 2, name: 'D' } });

  const result = await db.query({}, {
    sort: {
      'value.category': 1,
      'value.name': 1
    }
  });

  assert.strictEqual(result.length, 4);
  assert.strictEqual(result[0].value.category, 1);
  assert.strictEqual(result[0].value.name, 'A');
  assert.strictEqual(result[1].value.category, 1);
  assert.strictEqual(result[1].value.name, 'C');
  assert.strictEqual(result[2].value.category, 2);
  assert.strictEqual(result[2].value.name, 'B');
  assert.strictEqual(result[3].value.category, 2);
  assert.strictEqual(result[3].value.name, 'D');

  await db.close();
});

test('query with sort option', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 'gamma' });
  await db.insert({ value: 'alpha' });
  await db.insert({ value: 'beta' });
  const result = await db.query({}, { sort: { value: 1 } });
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].value, 'alpha');
  assert.strictEqual(result[1].value, 'beta');
  assert.strictEqual(result[2].value, 'gamma');
  await db.close();
});

test('query with project option', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 'gamma', extra: 'data' });
  await db.insert({ value: 'alpha', extra: 'info' });
  const result = await db.query({}, { project: { value: 1 } });

  result.sort((a, b) => a.value < b.value ? -1 : 1);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(Object.keys(result[0]).length, 1);
  assert.strictEqual(result[0].value, 'alpha');
  assert.strictEqual(Object.keys(result[1]).length, 1);
  assert.strictEqual(result[1].value, 'gamma');

  await db.close();
});

test('query with sort and project options', async () => {
  const db = await setupTestDb();
  await db.insert({ value: 'gamma', extra: 'data' });
  await db.insert({ value: 'alpha', extra: 'info' });
  await db.insert({ value: 'beta', extra: 'details' });
  const result = await db.query({}, { sort: { value: 1 }, project: { value: 1 } });
  assert.strictEqual(result.length, 3);
  assert.strictEqual(Object.keys(result[0]).length, 1);
  assert.strictEqual(result[0].value, 'alpha');
  assert.strictEqual(Object.keys(result[1]).length, 1);
  assert.strictEqual(result[1].value, 'beta');
  assert.strictEqual(Object.keys(result[2]).length, 1);
  assert.strictEqual(result[2].value, 'gamma');
  await db.close();
});

