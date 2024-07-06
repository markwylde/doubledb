import { promises as fs } from 'fs';
import test from 'node:test';
import { strict as assert } from 'node:assert';
import createDoubleDb, { DoubleDb } from '../src/index';

const testDir = './testData-' + Math.random();

test.after(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

test.skip('stress test', async (t) => {
  await t.test('stress test operations', async () => {
    await fs.rm(testDir, { recursive: true }).catch(() => {});
    const db: DoubleDb = await createDoubleDb(testDir);

    let id = 1;
    {
      const startTime = Date.now();
      for (let x = 0; x < 100; x++) {
        const actions: Array<{ type: string; key: string | number; value: string | number }> = [];
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
      assert.ok(true);
    }

    {
      const middleId = Math.floor(id / 2);
      const startTime = Date.now();
      const findRecords = await Promise.all([
        db.find('id', middleId),
        db.find('id', middleId + 20),
        db.find('id', middleId - 100)
      ]);
      const endTime = Date.now();

      console.log('Found', findRecords.length, 'in', endTime - startTime, 'ms');
      assert.deepStrictEqual(findRecords, [
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
      const middleId = Math.floor(id / 2);
      const startTime = Date.now();
      const readRecord = await db.read(Math.floor(middleId / 2));
      const endTime = Date.now();

      console.log('Read id', id, 'in', endTime - startTime, 'ms');
      assert.deepStrictEqual(readRecord, {
        id: Math.floor(middleId / 2),
        a: 1
      });
    }

    await db.close();
  });
});
