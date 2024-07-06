import { promises as fs } from 'node:fs';
import test from 'node:test';
import { strict as assert } from 'node:assert';
import createDoubleDb from '../src/index';

const testDir = './testData-' + Math.random();

test.after(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

test('indexes - single level - stores correct indexes', async (t) => {
  await t.test('single level indexes', async () => {
    await fs.rm(testDir, { recursive: true }).catch(() => {});
    const db = await createDoubleDb(testDir);

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

    const indexes: Array<{ key: string, value: string }> = [];

    for await (const [key, value] of db._level.iterator({ gt: 'indexes.', lt: 'indexes~' })) {
      indexes.push({ key, value });
    }

    db.close();

    assert.deepStrictEqual(indexes, [
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
});

test('replace - updates indexes correctly', async (t) => {
  await t.test('replace operation', async () => {
    await fs.rm(testDir, { recursive: true }).catch(() => {});
    const db = await createDoubleDb(testDir);

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
    assert.strictEqual(oldIndexes, undefined, 'Old index should be removed');

    const newFirstNameIndex = await db.find('firstName', 'Jane');
    assert.deepStrictEqual(newFirstNameIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Smith', occupation: 'Engineer' }, 'New firstName index should exist');

    const newLastNameIndex = await db.find('lastName', 'Smith');
    assert.deepStrictEqual(newLastNameIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Smith', occupation: 'Engineer' }, 'New lastName index should exist');

    const newOccupationIndex = await db.find('occupation', 'Engineer');
    assert.deepStrictEqual(newOccupationIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Smith', occupation: 'Engineer' }, 'New occupation index should exist');

    await db.close();
  });
});

test('patch - updates indexes correctly', async (t) => {
  await t.test('patch operation', async () => {
    await fs.rm(testDir, { recursive: true }).catch(() => {});
    const db = await createDoubleDb(testDir);

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
    assert.deepStrictEqual(updatedFirstNameIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'Updated firstName index should exist');

    const updatedAgeIndex = await db.find('age', 31);
    assert.deepStrictEqual(updatedAgeIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'Updated age index should exist');

    const newOccupationIndex = await db.find('occupation', 'Engineer');
    assert.deepStrictEqual(newOccupationIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'New occupation index should exist');

    const unchangedLastNameIndex = await db.find('lastName', 'Doe');
    assert.deepStrictEqual(unchangedLastNameIndex, { id: insertedRecord.id, firstName: 'Jane', lastName: 'Doe', age: 31, occupation: 'Engineer' }, 'Unchanged lastName index should still exist');

    const oldAgeIndex = await db.find('age', 30);
    assert.strictEqual(oldAgeIndex, undefined, 'Old age index should be removed');

    await db.close();
  });
});

test('remove - cleans up indexes correctly', async (t) => {
  await t.test('remove operation', async () => {
    await fs.rm(testDir, { recursive: true }).catch(() => {});
    const db = await createDoubleDb(testDir);

    const insertedRecord = await db.insert({
      firstName: 'John',
      lastName: 'Doe',
      age: 30
    });

    await db.remove(insertedRecord.id);

    const firstNameIndex = await db.find('firstName', 'John');
    assert.strictEqual(firstNameIndex, undefined, 'firstName index should be removed');

    const lastNameIndex = await db.find('lastName', 'Doe');
    assert.strictEqual(lastNameIndex, undefined, 'lastName index should be removed');

    const ageIndex = await db.find('age', 30);
    assert.strictEqual(ageIndex, undefined, 'age index should be removed');

    const removedDocument = await db.read(insertedRecord.id);
    assert.strictEqual(removedDocument, undefined, 'Document should be removed');

    await db.close();
  });
});
