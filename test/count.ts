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

test('count - basic functionality', async () => {
  const db = await setupTestDb();

  // Empty database should return 0
  assert.strictEqual(await db.count(), 0);

  // Add some documents
  await db.insert({ value: 'alpha' });
  await db.insert({ value: 'beta' });
  await db.insert({ value: 'gamma' });

  // Total count should be 3
  assert.strictEqual(await db.count(), 3);

  await db.close();
});

test('count - with simple query', async () => {
  const db = await setupTestDb();

  await db.insert({ value: 'alpha', type: 'letter' });
  await db.insert({ value: 'beta', type: 'letter' });
  await db.insert({ value: '1', type: 'number' });

  assert.strictEqual(await db.count({ type: 'letter' }), 2);
  assert.strictEqual(await db.count({ type: 'number' }), 1);

  await db.close();
});

test('count - with comparison operators', async () => {
  const db = await setupTestDb();

  await db.insert({ value: 5 });
  await db.insert({ value: 10 });
  await db.insert({ value: 15 });
  await db.insert({ value: 20 });

  assert.strictEqual(await db.count({ value: { $eq: 10 } }), 1);
  assert.strictEqual(await db.count({ value: { $ne: 10 } }), 3);
  assert.strictEqual(await db.count({ value: { $gt: 10 } }), 2);
  assert.strictEqual(await db.count({ value: { $gte: 10 } }), 3);
  assert.strictEqual(await db.count({ value: { $lt: 10 } }), 1);
  assert.strictEqual(await db.count({ value: { $lte: 10 } }), 2);

  await db.close();
});

test('count - with array operators', async () => {
  const db = await setupTestDb();

  await db.insert({ tags: ['a', 'b', 'c'] });
  await db.insert({ tags: ['a', 'b'] });
  await db.insert({ tags: ['a'] });
  await db.insert({ value: 'no-tags' });

  assert.strictEqual(await db.count({ tags: { $in: ['a'] } }), 3);
  assert.strictEqual(await db.count({ tags: { $nin: ['a'] } }), 1);
  assert.strictEqual(await db.count({ tags: { $all: ['a', 'b'] } }), 2);

  await db.close();
});

test('count - with existence checks', async () => {
  const db = await setupTestDb();

  await db.insert({ field1: 'exists', field2: 'also exists' });
  await db.insert({ field1: 'exists only' });
  await db.insert({ different: 'field' });

  assert.strictEqual(await db.count({ field1: { $exists: true } }), 2);
  assert.strictEqual(await db.count({ field1: { $exists: false } }), 1);
  assert.strictEqual(await db.count({ field2: { $exists: true } }), 1);
  assert.strictEqual(await db.count({ field2: { $exists: false } }), 2);

  await db.close();
});

test('count - with complex queries', async () => {
  const db = await setupTestDb();

  await db.insert({ type: 'fruit', name: 'apple', color: 'red' });
  await db.insert({ type: 'fruit', name: 'banana', color: 'yellow' });
  await db.insert({ type: 'vegetable', name: 'carrot', color: 'orange' });
  await db.insert({ type: 'vegetable', name: 'broccoli', color: 'green' });

  // Multiple conditions
  assert.strictEqual(await db.count({
    type: 'fruit',
    color: { $in: ['red', 'yellow'] }
  }), 2);

  // With $or operator
  assert.strictEqual(await db.count({
    $or: [
      { color: 'red' },
      { color: 'green' }
    ]
  }), 2);

  // Complex nested query
  assert.strictEqual(await db.count({
    type: 'vegetable',
    $or: [
      { color: 'orange' },
      { name: { $sw: 'br' } }
    ]
  }), 2);

  await db.close();
});

test('count - with nested fields', async () => {
  const db = await setupTestDb();

  await db.insert({ user: { name: 'John', age: 25 } });
  await db.insert({ user: { name: 'Jane', age: 30 } });
  await db.insert({ user: { name: 'Bob', age: 25 } });

  assert.strictEqual(await db.count({ 'user.age': 25 }), 2);
  assert.strictEqual(await db.count({ 'user.name': { $sw: 'J' } }), 2);

  await db.close();
});

test('count - after document modifications', async () => {
  const db = await setupTestDb();

  // Insert documents
  await db.insert({ type: 'test', value: 1 });
  await db.insert({ type: 'test', value: 2 });
  assert.strictEqual(await db.count({ type: 'test' }), 2);

  // Remove a document
  const docs = await db.query({ type: 'test' });
  await db.remove(docs[0].id!);
  assert.strictEqual(await db.count({ type: 'test' }), 1);

  // Update a document
  await db.patch(docs[1].id!, { type: 'modified' });
  assert.strictEqual(await db.count({ type: 'test' }), 0);
  assert.strictEqual(await db.count({ type: 'modified' }), 1);

  await db.close();
});

test('count - with batch operations', async () => {
  const db = await setupTestDb();

  // Batch insert
  await db.batchInsert([
    { type: 'batch', value: 1 },
    { type: 'batch', value: 2 },
    { type: 'batch', value: 3 }
  ]);

  assert.strictEqual(await db.count({ type: 'batch' }), 3);
  assert.strictEqual(await db.count({ value: { $gt: 1 } }), 2);

  await db.close();
});

test('count - with empty queries', async () => {
  const db = await setupTestDb();

  await db.insert({ value: 1 });
  await db.insert({ value: 2 });

  assert.strictEqual(await db.count({}), 2);
  assert.strictEqual(await db.count(), 2);

  await db.close();
});

test('count - with invalid queries', async () => {
  const db = await setupTestDb();

  await db.insert({ value: 1 });

  await assert.rejects(
    async () => await db.count({ $invalid: true }),
    /Unsupported top-level operator: \$invalid/
  );

  await db.close();
});
