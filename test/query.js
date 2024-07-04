import { promises as fs } from 'fs';
import test from 'node:test';
import assert from 'node:assert';
import createDoubleDb from '../index.js';

const testDir = './testData-' + Math.random();

test.after(async () => {
  fs.rm(testDir, { recursive: true, force: true });
});

test('query - found', async (t) => {
  await t.test('query operation', async () => {
    await fs.rm(testDir, { recursive: true }).catch(() => {});
    const db = await createDoubleDb(testDir);

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

    assert.deepStrictEqual(queryResult, [{
      id: insertedRecord3.id,
      category: 'b',
      firstName: 'Joe'
    }]);

    await db.close();
  });
});
