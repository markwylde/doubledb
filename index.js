import { promises as fs } from 'fs';
import { Level } from 'level';
import { v4 as uuid } from 'uuid';

function notFoundToUndefined (error) {
  if (error.code === 'LEVEL_NOT_FOUND') {
    return;
  }

  throw error;
}

const isObject = thing => thing instanceof Object && !Array.isArray(thing);

async function createDoubleDb (dataDirectory) {
  await fs.mkdir(dataDirectory, { recursive: true });

  const db = new Level(dataDirectory);

  async function addToIndexes (id, object, prefix = '') {
    const promises = Object.keys(object).map(key => {
      if (isObject(object[key])) {
        addToIndexes(id, object[key], prefix + '.' + key);
        return null;
      }

      if (Array.isArray(object[key])) {
        for (const index in object[key]) {
          db.put('indexes' + prefix + '.' + key + '=' + object[key][index] + '|' + id, id);
        }
        return null;
      }

      db.put('indexes' + prefix + '.' + key + '=' + object[key] + '|' + id, id);
      return null;
    });

    return Promise.all(promises);
  }

  async function insert (document) {
    if (!document) {
      throw new Error('doubledb.insert: no document was supplied to insert function');
    }

    if (document.id) {
      const existingDocument = await db.get(document.id)
        .catch(notFoundToUndefined);

      if (existingDocument) {
        throw new Error(`doubledb.insert: document with id ${document.id} already exists`);
      }
    }

    const id = document.id || uuid();
    const puttableRecord = {
      id,
      ...document
    };

    await db.put(id, JSON.stringify(puttableRecord));
    await addToIndexes(id, puttableRecord);

    return puttableRecord;
  }

  async function replace (id, newDocument) {
    if (!id) {
      throw new Error('doubledb.replace: no id was supplied to replace function');
    }

    if (!newDocument) {
      throw new Error('doubledb.replace: no newDocument was supplied to replace function');
    }

    if (newDocument.id && id !== newDocument.id) {
      throw new Error(`doubledb.replace: the id (${id}) and newDocument.id (${newDocument.id}) must be the same, or not defined`);
    }

    const existingDocument = await db.get(id)
      .catch(notFoundToUndefined);

    if (!existingDocument) {
      throw new Error(`doubledb.replace: document with id ${id} does not exist`);
    }

    const puttableRecord = {
      ...newDocument,
      id
    };
    await db.put(id, JSON.stringify(puttableRecord));

    return puttableRecord;
  }

  async function patch (id, newDocument) {
    if (!id) {
      throw new Error('doubledb.patch: no id was supplied to patch function');
    }

    if (!newDocument) {
      throw new Error('doubledb.patch: no newDocument was supplied to patch function');
    }

    if (newDocument.id && id !== newDocument.id) {
      throw new Error(`doubledb.patch: the id (${id}) and newDocument.id (${newDocument.id}) must be the same, or not defined`);
    }

    const existingDocument = await db.get(id)
      .catch(notFoundToUndefined);

    if (!existingDocument) {
      throw new Error(`doubledb.patch: document with id ${id} does not exist`);
    }

    const puttableRecord = {
      ...JSON.parse(existingDocument),
      ...newDocument,
      id
    };
    await db.put(id, JSON.stringify(puttableRecord));

    return puttableRecord;
  }

  async function read (id) {
    const document = await db.get(id)
      .catch(notFoundToUndefined);

    if (!document) {
      return;
    }

    return JSON.parse(document);
  }

  async function findOrFilter (type, key, value) {
    const promises = [];
    for await (const ckey of db.keys({
      gt: `indexes.${key}=${value}.`,
      lt: `indexes.${key}=${value}~`
    })) {
      const [, lvalueAndKey] = ckey.split('=');
      const lvalue = lvalueAndKey.split('|')[0];

      if (lvalue == value) {
        const id = await db.get(ckey);
        promises.push(read(id));
        if (type === 'find') {
          break;
        }
      }
    }

    const results = await Promise.all(promises);
    if (type === 'filter') {
      return results;
    } else {
      return results[0];
    }
  }

  async function findOrFilterByFunction (type, key, fn) {
    const promises = [];
    for await (const ckey of db.keys({
      gt: `indexes.${key}.`,
      lt: `indexes.${key}~`
    })) {
      const [, lvalueAndKey] = ckey.split('=');
      const lvalue = lvalueAndKey.split('|')[0];

      if (fn(lvalue)) {
        const id = await db.get(ckey);
        promises.push(read(id));
        if (type === 'find') {
          break;
        }
      }
    }

    const results = await Promise.all(promises);
    if (type === 'filter') {
      return results;
    } else {
      return results[0];
    }
  }

  async function find (key, valueOrFunction) {
    return valueOrFunction instanceof Function
      ? findOrFilterByFunction('find', key, valueOrFunction)
      : findOrFilter('find', key, valueOrFunction);
  }

  async function filter (key, valueOrFunction) {
    return valueOrFunction instanceof Function
      ? findOrFilterByFunction('filter', key, valueOrFunction)
      : findOrFilter('filter', key, valueOrFunction);
  }

  async function remove (id) {
    if (!id) {
      throw new Error('doubledb.remove: no id was supplied to replace function');
    }

    const existingDocument = await db.get(id)
      .catch(notFoundToUndefined);

    if (!existingDocument) {
      throw new Error(`doubledb.remove: document with id ${id} does not exist`);
    }

    return db.del(id);
  }

  return {
    _level: db,
    find,
    filter,
    insert,
    replace,
    patch,
    remove,
    read,
    close: db.close.bind(db)
  };
}

export default createDoubleDb;
