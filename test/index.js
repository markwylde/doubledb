import { promises as fs } from 'fs';
import test from 'basictap';
import createDoubleDb from '../index.js';

await import('./indexes.js');
await import('./functionFinds.js');

test('find - top level key found - returns document', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');
  await db.insert({ id: 'id1', a: 1 });
  await db.insert({ id: 'id2', a: 2 });
  await db.insert({ id: 'id3', a: 3 });
  await db.insert({ id: 'id4', a: 4 });

  const findRecord = await db.find('a', 2);

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id2',
    a: 2
  });
});

test('find - with skip', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');
  await db.insert({ id: 'id1', a: 1 });
  await db.insert({ id: 'id2', a: 1 });
  await db.insert({ id: 'id3', a: 1 });
  await db.insert({ id: 'id4', a: 1 });

  const findRecord = await db.find('a', 1, { skip: 2 });

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id3',
    a: 1
  });
});

test('find - nested key found - returns document', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');
  await db.insert({ id: 'id1', a: { b: 1 } });
  await db.insert({ id: 'id2', a: { b: 2 } });
  await db.insert({ id: 'id3', a: { b: 3 } });
  await db.insert({ id: 'id4', a: { b: 4 } });

  const findRecord = await db.find('a.b', 2);

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id2',
    a: {
      b: 2
    }
  });
});

test('find - array top level key found - returns document', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');
  await db.insert({ id: 'id1', a: [1, 2] });
  await db.insert({ id: 'id2', a: [2, 3] });
  await db.insert({ id: 'id3', a: [3, 4] });
  await db.insert({ id: 'id4', a: [4, 5] });

  const findRecord = await db.find('a', 2);

  await db.close();

  t.deepEqual(findRecord, {
    id: 'id1',
    a: [1, 2]
  });
});

test('filter - with skip', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');
  await db.insert({ id: 'id1', a: 1 });
  await db.insert({ id: 'id2', a: 1, b: 1 });
  await db.insert({ id: 'id3', a: 1, b: 1 });
  await db.insert({ id: 'id4', a: 1 });

  const filterRecords = await db.filter('b', 1, { skip: 1 });

  await db.close();

  t.deepEqual(filterRecords, [
    {
      a: 1,
      b: 1,
      id: 'id3'
    }
  ]);
});

test('filter - with limit', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');
  await db.insert({ id: 'id1', a: 1 });
  await db.insert({ id: 'id2', a: 1, b: 1 });
  await db.insert({ id: 'id3', a: 1, b: 1 });
  await db.insert({ id: 'id4', a: 1 });

  const filterRecords = await db.filter('b', 1, { limit: 1 });

  await db.close();

  t.deepEqual(filterRecords, [
    {
      a: 1,
      b: 1,
      id: 'id2'
    }
  ]);
});

test('filter - top level key found - returns documents', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');
  await db.insert({ id: 'id1', a: 1 });
  await db.insert({ id: 'id2', a: 2, b: 1 });
  await db.insert({ id: 'id3', a: 2, b: 2 });
  await db.insert({ id: 'id4', a: 4 });

  const filterRecords = await db.filter('a', 2);

  await db.close();

  t.deepEqual(filterRecords, [
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

test('read - no id supplied - throws', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');
  const readRecord = await db.read('nothing in here');
  await db.close();

  t.equal(readRecord, undefined);
});

test('read - found - returns document', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

  await fs.rm('./testData', { recursive: true }).catch(() => {});
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

test('query - found', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');

  await db.insert({
    category: 'a',
    firstName: 'Joe'
  });
  await db.insert({
    category: 'b',
    firstName: 'Nope'
  });
  const insertedRecord3 = await db.insert({
    category: 'b',
    firstName: 'Joe'
  });
  const queryResult = await db.query({
    category: 'b',
    $or: [{
      firstName: {
        $eq: 'Joe',
      },
    }, {
      firstName: {
        $eq: 'joe',
      }
    }]
  });

  t.deepEqual(queryResult, [{
    id: insertedRecord3.id,
    category: 'b',
    firstName: 'Joe'
  }]);

  return () => db.close();
});

// Index resets

test('replace - updates indexes correctly', async t => {
  t.plan(4);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');

  // Insert initial document
  const insertedRecord = await db.insert({
    firstName: 'John',
    lastName: 'Doe',
    age: 30
  });

  // Replace the document
  await db.replace(insertedRecord.id, {
    firstName: 'Jane',
    lastName: 'Smith',
    occupation: 'Engineer'
  });

  // Check if old indexes are removed
  const oldIndexes = await db.find('age', 30);
  t.equal(oldIndexes, undefined, 'Old index should be removed');

  // Check if new indexes are added
  const newFirstNameIndex = await db.find('firstName', 'Jane');
  t.deepEqual(newFirstNameIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Smith', occupation: 'Engineer' }, 'New firstName index should exist');

  const newLastNameIndex = await db.find('lastName', 'Smith');
  t.deepEqual(newLastNameIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Smith', occupation: 'Engineer' }, 'New lastName index should exist');

  const newOccupationIndex = await db.find('occupation', 'Engineer');
  t.deepEqual(newOccupationIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Smith', occupation: 'Engineer' }, 'New occupation index should exist');

  await db.close();
});

test('patch - updates indexes correctly', async t => {
  t.plan(5);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');

  // Insert initial document
  const insertedRecord = await db.insert({
    firstName: 'John',
    lastName: 'Doe',
    age: 30
  });

  // Patch the document
  await db.patch(insertedRecord.id, {
    firstName: 'Jane',
    age: 31,
    occupation: 'Engineer'
  });

  // Check if updated indexes are correct
  const updatedFirstNameIndex = await db.find('firstName', 'Jane');
  t.deepEqual(updatedFirstNameIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'Updated firstName index should exist');

  const updatedAgeIndex = await db.find('age', 31);
  t.deepEqual(updatedAgeIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'Updated age index should exist');

  // Check if new index is added
  const newOccupationIndex = await db.find('occupation', 'Engineer');
  t.deepEqual(newOccupationIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'New occupation index should exist');

  // Check if unchanged index still exists
  const unchangedLastNameIndex = await db.find('lastName', 'Doe');
  t.deepEqual(unchangedLastNameIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'Unchanged lastName index should still exist');

  // Check if old index is removed
  const oldAgeIndex = await db.find('age', 30);
  t.equal(oldAgeIndex, undefined, 'Old age index should be removed');

  await db.close();
});

test('remove - cleans up indexes correctly', async t => {
  t.plan(4);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');

  // Insert initial document
  const insertedRecord = await db.insert({
    firstName: 'John',
    lastName: 'Doe',
    age: 30
  });

  // Remove the document
  await db.remove(insertedRecord.id);

  // Check if all indexes are removed
  const firstNameIndex = await db.find('firstName', 'John');
  t.equal(firstNameIndex, undefined, 'firstName index should be removed');

  const lastNameIndex = await db.find('lastName', 'Doe');
  t.equal(lastNameIndex, undefined, 'lastName index should be removed');

  const ageIndex = await db.find('age', 30);
  t.equal(ageIndex, undefined, 'age index should be removed');

  // Check if the document is actually removed
  const removedDocument = await db.read(insertedRecord.id);
  t.equal(removedDocument, undefined, 'Document should be removed');

  await db.close();
});

test.trigger();
