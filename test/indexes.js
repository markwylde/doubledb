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
  db._level.createReadStream({ gt: 'indexes.', lt: 'indexesz' })
    .on('data', function (data) {
      indexes.push(data);
    })
    .on('end', function () {
      console.log('Stream ended');
      db.close();

      t.deepEqual(indexes, [
        { key: 'indexes.id=myid', value: 'myid' },
        { key: 'indexes.nested.a=1', value: 'myid' },
        { key: 'indexes.testNumberA=1', value: 'myid' },
        { key: 'indexes.testNumberB=2', value: 'myid' },
        { key: 'indexes.testStringA=this is test a', value: 'myid' },
        { key: 'indexes.testStringB=this is test a', value: 'myid' }
      ]);
    });
});
