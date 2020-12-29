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
    const insertableRecord = {
      id,
      ...document
    };
    await db.put(id, JSON.stringify(insertableRecord));

    return insertableRecord;
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
    read,
    close: db.close.bind(db)
  };
}

module.exports = createDoubleDb;
