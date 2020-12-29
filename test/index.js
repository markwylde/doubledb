const fs = require('fs').promises;

const test = require('basictap');
const createDoubleDb = require('../');

test('read - no id supplied - throws', async t => {
  t.plan(1);

  await fs.rmdir('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');
  try {
    await db.read();
  } catch (error) {
    await db.close();
    t.equal(error.message, 'key cannot be `null` or `undefined`');
  }
});

test('read - not found - returns undefined', async t => {
  t.plan(1);

  await fs.rmdir('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');
  const readRecord = await db.read('nothing in here');
  await db.close();

  t.equal(readRecord, undefined);
});

test('read - found - returns document', async t => {
  t.plan(1);

  await fs.rmdir('./testData', { recursive: true });
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

  await fs.rmdir('./testData', { recursive: true });
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

  await fs.rmdir('./testData', { recursive: true });
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

  await fs.rmdir('./testData', { recursive: true });
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

  await fs.rmdir('./testData', { recursive: true });
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

  await fs.rmdir('./testData', { recursive: true });
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

  await fs.rmdir('./testData', { recursive: true });
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

  await fs.rmdir('./testData', { recursive: true });
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
