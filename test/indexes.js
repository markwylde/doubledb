import { promises as fs } from 'fs';
import test from 'basictap';
import createDoubleDb from '../index.js';

test('indexes - single level - stores correct indexes', async t => {
  t.plan(1);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');

  await db.insert({
    id: 'myid',
    testStringA: 'this is test a',
    testStringB: 'this is test a',
    testNumberA: 1,
    testNumberB: 2,
    nested: {
      a: 1
    },
    array: ['testa', 'testb']
  });

  const indexes = [];

  for await (const [key, value] of db._level.iterator({ gt: 'indexes.', lt: 'indexes~' })) {
    indexes.push({ key, value });
  }

  db.close();

  t.deepEqual(indexes, [
    { key: 'indexes.array=testa|myid', value: 'myid' },
    { key: 'indexes.array=testb|myid', value: 'myid' },
    { key: 'indexes.id=myid|myid', value: 'myid' },
    { key: 'indexes.nested.a=1|myid', value: 'myid' },
    { key: 'indexes.testNumberA=1|myid', value: 'myid' },
    { key: 'indexes.testNumberB=2|myid', value: 'myid' },
    { key: 'indexes.testStringA=this is test a|myid', value: 'myid' },
    { key: 'indexes.testStringB=this is test a|myid', value: 'myid' }
  ]);
});


test('replace - updates indexes correctly', async t => {
  t.plan(4);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');

  const insertedRecord = await db.insert({
    firstName: 'John',
    lastName: 'Doe',
    age: 30
  });

  await db.replace(insertedRecord.id, {
    firstName: 'Jane',
    lastName: 'Smith',
    occupation: 'Engineer'
  });

  const oldIndexes = await db.find('age', 30);
  t.equal(oldIndexes, undefined, 'Old index should be removed');

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

  const insertedRecord = await db.insert({
    firstName: 'John',
    lastName: 'Doe',
    age: 30
  });

  await db.patch(insertedRecord.id, {
    firstName: 'Jane',
    age: 31,
    occupation: 'Engineer'
  });

  const updatedFirstNameIndex = await db.find('firstName', 'Jane');
  t.deepEqual(updatedFirstNameIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'Updated firstName index should exist');

  const updatedAgeIndex = await db.find('age', 31);
  t.deepEqual(updatedAgeIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'Updated age index should exist');

  const newOccupationIndex = await db.find('occupation', 'Engineer');
  t.deepEqual(newOccupationIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'New occupation index should exist');

  const unchangedLastNameIndex = await db.find('lastName', 'Doe');
  t.deepEqual(unchangedLastNameIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'Unchanged lastName index should still exist');

  const oldAgeIndex = await db.find('age', 30);
  t.equal(oldAgeIndex, undefined, 'Old age index should be removed');

  await db.close();
});

test('remove - cleans up indexes correctly', async t => {
  t.plan(4);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');

  const insertedRecord = await db.insert({
    firstName: 'John',
    lastName: 'Doe',
    age: 30
  });

  await db.remove(insertedRecord.id);

  const firstNameIndex = await db.find('firstName', 'John');
  t.equal(firstNameIndex, undefined, 'firstName index should be removed');

  const lastNameIndex = await db.find('lastName', 'Doe');
  t.equal(lastNameIndex, undefined, 'lastName index should be removed');

  const ageIndex = await db.find('age', 30);
  t.equal(ageIndex, undefined, 'age index should be removed');

  const removedDocument = await db.read(insertedRecord.id);
  t.equal(removedDocument, undefined, 'Document should be removed');

  await db.close();
});
