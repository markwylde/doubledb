import { promises as fs } from 'fs';
import test from 'basictap';
import createDoubleDb from '../index.js';

test('stress test', async t => {
  t.plan(3);

  await fs.rm('./testData', { recursive: true }).catch(() => {});
  const db = await createDoubleDb('./testData');

  let id = 1;
  {
    const startTime = Date.now();
    for (let x = 0; x < 100; x++) {
      const actions = [];
      console.log(x);
      for (let y = 0; y < 10000; y++) {
        id++;
        actions.push({
          type: 'put',
          key: id,
          value: JSON.stringify({
            id,
            a: 1
          })
        });
        actions.push({
          type: 'put',
          key: `indexes.a=1|${id}`,
          value: id
        });
        actions.push({
          type: 'put',
          key: `indexes.id=${id}|${id}`,
          value: id
        });
      }
      await db._level.batch(actions);
    }
    const endTime = Date.now();

    console.log('Total inserted', id, 'in', endTime - startTime, 'ms');
    t.pass();
  }

  {
    const middleId = parseInt(id / 2);
    const startTime = Date.now();
    const findRecords = await Promise.all([
      db.find('id', middleId),
      db.find('id', middleId + 20),
      db.find('id', middleId - 100)
    ]);
    const endTime = Date.now();

    console.log('Found', findRecords.length, 'in', endTime - startTime, 'ms');
    t.deepEqual(findRecords, [
      {
        a: 1,
        id: middleId
      },
      {
        a: 1,
        id: middleId + 20
      },
      {
        a: 1,
        id: middleId - 100
      }
    ]);
  }

  {
    const middleId = parseInt(id / 2);
    const startTime = Date.now();
    const readRecord = await db.read(parseInt(middleId / 2));
    const endTime = Date.now();

    console.log('Read id', id, 'in', endTime - startTime, 'ms');
    t.deepEqual(readRecord, {
      id: parseInt(middleId / 2),
      a: 1
    });
  }

  await db.close();
});
