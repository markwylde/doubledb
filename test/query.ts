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
