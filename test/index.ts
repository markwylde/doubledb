import { promises as fs } from 'node:fs';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import createDoubleDb from '../dist/index.js';

const testDir = './testData-' + Math.random();

after(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

test('find - top level key found - returns document', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  await db.insert({ id: 'id1', a: 1 });
  await db.insert({ id: 'id2', a: 2 });
  await db.insert({ id: 'id3', a: 3 });
  await db.insert({ id: 'id4', a: 4 });

  const findRecord = await db.find('a', 2);

  await db.close();

  assert.deepStrictEqual(findRecord, {
    id: 'id2',
    a: 2
  });
});

test('find - with skip', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  await db.insert({ id: 'id1', a: 1 });
  await db.insert({ id: 'id2', a: 1 });
  await db.insert({ id: 'id3', a: 1 });
  await db.insert({ id: 'id4', a: 1 });

  const findRecord = await db.find('a', 1, { skip: 2 });

  await db.close();

  assert.deepStrictEqual(findRecord, {
    id: 'id3',
    a: 1
  });
});

test('find - nested key found - returns document', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  await db.insert({ id: 'id1', a: { b: 1 } });
  await db.insert({ id: 'id2', a: { b: 2 } });
  await db.insert({ id: 'id3', a: { b: 3 } });
  await db.insert({ id: 'id4', a: { b: 4 } });

  const findRecord = await db.find('a.b', 2);

  await db.close();

  assert.deepStrictEqual(findRecord, {
    id: 'id2',
    a: {
      b: 2
    }
  });
});

test('find - array top level key found - returns document', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  await db.insert({ id: 'id1', a: [1, 2] });
  await db.insert({ id: 'id2', a: [2, 3] });
  await db.insert({ id: 'id3', a: [3, 4] });
  await db.insert({ id: 'id4', a: [4, 5] });

  const findRecord = await db.find('a', 2);

  await db.close();

  assert.deepStrictEqual(findRecord, {
    id: 'id1',
    a: [1, 2]
  });
});

test('filter - with skip', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  await db.insert({ id: 'id1', a: 1 });
  await db.insert({ id: 'id2', a: 1, b: 1 });
  await db.insert({ id: 'id3', a: 1, b: 1 });
  await db.insert({ id: 'id4', a: 1 });

  const filterRecords = await db.filter('b', 1, { skip: 1 });

  await db.close();

  assert.deepStrictEqual(filterRecords, [
    {
      a: 1,
      b: 1,
      id: 'id3'
    }
  ]);
});

test('filter - with limit', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  await db.insert({ id: 'id1', a: 1 });
  await db.insert({ id: 'id2', a: 1, b: 1 });
  await db.insert({ id: 'id3', a: 1, b: 1 });
  await db.insert({ id: 'id4', a: 1 });

  const filterRecords = await db.filter('b', 1, { limit: 1 });

  await db.close();

  assert.deepStrictEqual(filterRecords, [
    {
      a: 1,
      b: 1,
      id: 'id2'
    }
  ]);
});

test('filter - top level key found - returns documents', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  await db.insert({ id: 'id1', a: 1 });
  await db.insert({ id: 'id2', a: 2, b: 1 });
  await db.insert({ id: 'id3', a: 2, b: 2 });
  await db.insert({ id: 'id4', a: 4 });

  const filterRecords = await db.filter('a', 2);

  await db.close();

  assert.deepStrictEqual(filterRecords, [
    {
      a: 2,
      b: 1,
      id: 'id2'
    },
    {
      a: 2,
      b: 2,
      id: 'id3'
    }
  ]);
});

test('read - no id supplied - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.read();
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'Key cannot be null or undefined');
  }
});

test('read - not found - returns undefined', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  const readRecord = await db.read('nothing in here');
  await db.close();

  assert.strictEqual(readRecord, undefined);
});

test('read - found - returns document', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  const insertedRecord = await db.insert({
    a: 1
  });

  const readRecord = await db.read(insertedRecord.id);

  await db.close();

  assert.strictEqual(readRecord.a, 1);
});

test('create - existing key - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  await db.insert({
    id: 'myid',
    a: 1
  });

  try {
    await db.insert({
      id: 'myid',
      a: 1
    });
  } catch (error) {
    assert.strictEqual((error as Error).message, 'doubledb.insert: document with id myid already exists');
  }

  await db.close();
});

test('create - missing arguments - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.insert();
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.insert: no document was supplied to insert function');
  }
});

test('replace - missing id argument - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.replace(null);
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.replace: no id was supplied to replace function');
  }
});

test('replace - missing newDocument argument - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.replace(1);
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.replace: no newDocument was supplied to replace function');
  }
});

test('replace - none matching id and newDocument.id - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.replace(1, { id: 2 });
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.replace: the id (1) and newDocument.id (2) must be the same, or not defined');
  }
});

test('replace - not found - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.replace(1, { a: 1 });
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.replace: document with id 1 does not exist');
  }
});

test('replace - found - returns new document', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  const insertedRecord = await db.insert({
    a: 1
  });

  const updatedRecord = await db.replace(insertedRecord.id, {
    a: 2
  });

  const readRecord = await db.read(insertedRecord.id);

  await db.close();

  assert.strictEqual(updatedRecord.id, insertedRecord.id);
  assert.strictEqual(updatedRecord.a, 2);
  assert.strictEqual(readRecord.a, 2);
});

test('patch - missing id argument - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.patch(null);
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.patch: no id was supplied to patch function');
  }
});

test('patch - missing newDocument argument - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.patch(1);
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.patch: no newDocument was supplied to patch function');
  }
});

test('patch - none matching id and newDocument.id - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.patch(1, { id: 2 });
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.patch: the id (1) and newDocument.id (2) must be the same, or not defined');
  }
});

test('patch - not found - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.patch(1, { a: 1 });
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.patch: document with id 1 does not exist');
  }
});

test('patch - found - returns patched document', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  const insertedRecord = await db.insert({
    a: 1,
    b: 2
  });

  const updatedRecord = await db.patch(insertedRecord.id, {
    b: 3,
    c: 4
  });

  const readRecord = await db.read(insertedRecord.id);

  await db.close();

  assert.deepStrictEqual(updatedRecord, {
    id: insertedRecord.id,
    a: 1,
    b: 3,
    c: 4
  });

  assert.deepStrictEqual(readRecord, {
    id: insertedRecord.id,
    a: 1,
    b: 3,
    c: 4
  });
});

test('remove - missing id argument - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.remove(null);
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.remove: no id was supplied to replace function');
  }
});

test('remove - not found - throws', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);

  try {
    await db.remove('nothing');
  } catch (error) {
    await db.close();
    assert.strictEqual((error as Error).message, 'doubledb.remove: document with id nothing does not exist');
  }
});

test('remove - found - removes document', async () => {
  await fs.rm(testDir, { recursive: true }).catch(() => {});
  const db = await createDoubleDb(testDir);
  const insertedRecord = await db.insert({
    a: 1
  });
  const readBefore = await db.read(insertedRecord.id);
  const removeResult = await db.remove(insertedRecord.id);
  const readAfter = await db.read(insertedRecord.id);

  await db.close();

  assert.strictEqual(readBefore.id, insertedRecord.id);
  assert.strictEqual(readAfter, undefined);
  assert.strictEqual(removeResult, undefined);
});
