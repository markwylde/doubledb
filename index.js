const fs = require('fs').promises;
const level = require('level');
const uuid = require('uuid').v4;

function notFoundToUndefined (error) {
  if (error.name === 'NotFoundError') {
    return;
  }

  throw error;
}

async function createDoubleDb (dataDirectory) {
  await fs.mkdir(dataDirectory, { recursive: true });

  const db = level(dataDirectory);

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

  async function read (id) {
    const document = await db.get(id)
      .catch(notFoundToUndefined);

    if (!document) {
      return;
    }

    return JSON.parse(document);
  }

  return {
    _level: db,
    insert,
    replace,
    read,
    close: db.close.bind(db)
  };
}

module.exports = createDoubleDb;
