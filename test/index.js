const fs = require('fs').promises;

const test = require('basictap');
const createDoubleDb = require('../');

require('./indexes');

test('read - no id supplied - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.read();
  } catch (error) {
    await db.close();
    t.equal(error.message, 'Key cannot be null or undefined');
  }
});

test('read - not found - returns undefined', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');
  const readRecord = await db.read('nothing in here');
  await db.close();

  t.equal(readRecord, undefined);
});

test('read - found - returns document', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');
  const insertedRecord = await db.insert({
    a: 1
  });

  const readRecord = await db.read(insertedRecord.id);

  await db.close();

  t.equal(readRecord.a, 1);
});

test('create - existing key - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');
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
    t.equal(error.message, 'doubledb.insert: document with id myid already exists');
  }

  await db.close();
});

test('create - missing arguments - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.insert();
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.insert: no document was supplied to insert function');
  }
});

test('replace - missing id argument - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.replace(null);
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.replace: no id was supplied to replace function');
  }
});

test('replace - missing newDocument argument - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.replace(1);
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.replace: no newDocument was supplied to replace function');
  }
});

test('replace - none matching id and newDocument.id - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.replace(1, { id: 2 });
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.replace: the id (1) and newDocument.id (2) must be the same, or not defined');
  }
});

test('replace - not found - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.replace(1, { a: 1 });
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.replace: document with id 1 does not exist');
  }
});

test('replace - found - returns new document', async t => {
  t.plan(3);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');
  const insertedRecord = await db.insert({
    a: 1
  });

  const updatedRecord = await db.replace(insertedRecord.id, {
    a: 2
  });

  const readRecord = await db.read(insertedRecord.id);

  await db.close();

  t.equal(updatedRecord.id, insertedRecord.id);
  t.equal(updatedRecord.a, 2);
  t.equal(readRecord.a, 2);
});

test('patch - missing id argument - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.patch(null);
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.patch: no id was supplied to patch function');
  }
});

test('patch - missing newDocument argument - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.patch(1);
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.patch: no newDocument was supplied to patch function');
  }
});

test('patch - none matching id and newDocument.id - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.patch(1, { id: 2 });
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.patch: the id (1) and newDocument.id (2) must be the same, or not defined');
  }
});

test('patch - not found - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.patch(1, { a: 1 });
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.patch: document with id 1 does not exist');
  }
});

test('patch - found - returns patched document', async t => {
  t.plan(2);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');
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

  t.deepEqual(updatedRecord, {
    id: insertedRecord.id,
    a: 1,
    b: 3,
    c: 4
  });

  t.deepEqual(readRecord, {
    id: insertedRecord.id,
    a: 1,
    b: 3,
    c: 4
  });
});

test('remove - missing id argument - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.remove(null);
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.remove: no id was supplied to replace function');
  }
});

test('remove - not found - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  try {
    await db.remove('nothing');
  } catch (error) {
    await db.close();
    t.equal(error.message, 'doubledb.remove: document with id nothing does not exist');
  }
});

test('remove - found - removes document', async t => {
  t.plan(3);

  await fs.rm('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');
  const insertedRecord = await db.insert({
    a: 1
  });
  const readBefore = await db.read(insertedRecord.id);
  const removeResult = await db.remove(insertedRecord.id);
  const readAfter = await db.read(insertedRecord.id);

  await db.close();

  t.equal(readBefore.id, insertedRecord.id);
  t.equal(readAfter, undefined);
  t.equal(removeResult, undefined);
});
