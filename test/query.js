import { promises as fs } from 'fs';
import test from 'basictap';
import createDoubleDb from '../index.js';

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
