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
    t.equal(error.message, 'doubledb.insert: no document was supplied to insert function');
  }

  await db.close();
});
