const fs = require('fs').promises;
const { Level } = require('level');
const uuid = require('uuid').v4;

function notFoundToUndefined (error) {
  if (error.code === 'LEVEL_NOT_FOUND') {
    return;
  }

  throw error;
}

async function createDoubleDb (dataDirectory) {
  await fs.mkdir(dataDirectory, { recursive: true });

  const db = new Level(dataDirectory);

  async function addToIndexes (id, object, prefix = '') {
    const promises = Object.keys(object).map(key => {
      if (typeof object[key] === 'object') {
        return addToIndexes(id, object[key], prefix + '.' + key);
      }

      return db.put('indexes' + prefix + '.' + key + '.' + id + '=' + object[key], id);
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
    insert,
    replace,
    patch,
    remove,
    read,
    close: db.close.bind(db)
  };
}

module.exports = createDoubleDb;
