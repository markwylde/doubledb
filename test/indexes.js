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
