const fs = require('fs').promises;

const test = require('basictap');
const createDoubleDb = require('../');

test('indexes - single level - stores correct indexes', async t => {
  t.plan(1);

  await fs.rmdir('./testData', { recursive: true });
  const db = await createDoubleDb('./testData');

  await db.insert({
    id: 'myid',
    testStringA: 'this is test a',
    testStringB: 'this is test a',
    testNumberA: 1,
    testNumberB: 2,
    nested: {
      a: 1
    }
  });

  const indexes = [];

  for await (const [key, value] of db._level.iterator({ gt: 'indexes.', lt: 'indexes~' })) {
    indexes.push({ key, value });
  }

  console.log('Stream ended');
  db.close();

  t.deepEqual(indexes, [
    { key: 'indexes.id.myid=myid', value: 'myid' },
    { key: 'indexes.nested.a.myid=1', value: 'myid' },
    { key: 'indexes.testNumberA.myid=1', value: 'myid' },
    { key: 'indexes.testNumberB.myid=2', value: 'myid' },
    { key: 'indexes.testStringA.myid=this is test a', value: 'myid' },
    { key: 'indexes.testStringB.myid=this is test a', value: 'myid' }
  ]);
});
