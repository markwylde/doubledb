import { promises as fs } from 'fs';
import { Level } from 'level';
import { v4 as uuid } from 'uuid';

export const FirstUnicodeCharacter = '\u{0000}';
export const LastUnicodeCharacter = '\u{10FFFF}';

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

  async function addToIndexes(id, object, prefix = '') {
    const promises = [];

    const addIndex = (key, value) => {
      return db.put('indexes' + prefix + '.' + key + '=' + value + '|' + id, id);
    };

    for (const [key, value] of Object.entries(object)) {
      if (isObject(value)) {
        promises.push(addToIndexes(id, value, prefix + '.' + key));
      } else if (Array.isArray(value)) {
        value.forEach(item => promises.push(addIndex(key, item)));
      } else {
        promises.push(addIndex(key, value));
      }
    }

    return Promise.all(promises);
  }

  async function removeIndexesForDocument(id, document, prefix = '') {
    const parsedDocument = typeof document === 'string' ? JSON.parse(document) : document;
    const promises = [];

    const removeIndex = (key, value) => {
      return db.del('indexes' + prefix + '.' + key + '=' + value + '|' + id).catch(() => {});
    };

    for (const [key, value] of Object.entries(parsedDocument)) {
      if (isObject(value)) {
        promises.push(removeIndexesForDocument(id, value, prefix + '.' + key));
      } else if (Array.isArray(value)) {
        value.forEach(item => promises.push(removeIndex(key, item)));
      } else {
        promises.push(removeIndex(key, value));
      }
    }

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

    await removeIndexesForDocument(id, existingDocument);

    const puttableRecord = {
      ...newDocument,
      id
    };
    await db.put(id, JSON.stringify(puttableRecord));

    await addToIndexes(id, puttableRecord);

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

    await removeIndexesForDocument(id, existingDocument);

    const puttableRecord = {
      ...JSON.parse(existingDocument),
      ...newDocument,
      id
    };
    await db.put(id, JSON.stringify(puttableRecord));

    await addToIndexes(id, puttableRecord);

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

  async function findOrFilter (type, key, value, options) {
    options = {
      skip: 0,
      limit: type === 'find' ? 1 : Infinity,
      ...options
    };
    const promises = [];
    let skipIndex = 0;
    for await (const ckey of db.keys({
      gt: `indexes.${key}=${value}|`,
      lte: `indexes.${key}=${value}|${LastUnicodeCharacter}`
    })) {
      const [, lvalueAndKey] = ckey.split('=');
      const lvalue = lvalueAndKey.split('|')[0];

      if (lvalue == value) {
        if (skipIndex < options.skip) {
          skipIndex = skipIndex + 1;
          continue;
        }

        const id = await db.get(ckey);
        promises.push(read(id));
        if (type === 'find') {
          break;
        }

        if (promises.length >= options.limit) {
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

  async function findOrFilterByFunction (type, key, fn, options) {
    options = {
      skip: 0,
      limit: type === 'find' ? 1 : Infinity,
      gt: options?.gt,
      lt: options?.lt,
      lte: options?.lte,
      gte: options?.gte,
      ...options
    };
    const promises = [];
    let skipIndex = 0;

    const query = {};

    if (options.gte) {
      query.gte = `indexes.${key}=${options.gte}`;
    }
    if (options.gt) {
      query.gt = `indexes.${key}=${options.gt}|${LastUnicodeCharacter}`;
    }
    if (options.lte) {
      query.lte = `indexes.${key}=${options.lte}|${LastUnicodeCharacter}`;
    }
    if (options.lt) {
      query.lt = `indexes.${key}=${options.lt}|${FirstUnicodeCharacter}`;
    }
    if (!options.lt && !options.lte) {
      query.lte = `indexes.${key}=${LastUnicodeCharacter}`;
    }
    if (!options.gt && !options.gte) {
      query.gte = `indexes.${key}=`;
    }

    for await (const ckey of db.keys(query)) {
      const [, lvalueAndKey] = ckey.split('=');
      const lvalue = lvalueAndKey.split('|')[0];

      if (fn(lvalue)) {
        if (skipIndex < options.skip) {
          skipIndex = skipIndex + 1;
          continue;
        }

        const id = await db.get(ckey);
        promises.push(read(id));
        if (type === 'find') {
          break;
        }

        if (promises.length >= options.limit) {
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

  async function find (key, valueOrFunction, options) {
    return valueOrFunction instanceof Function
      ? findOrFilterByFunction('find', key, valueOrFunction, options)
      : findOrFilter('find', key, valueOrFunction, options);
  }

  async function filter (key, valueOrFunction, options) {
    return valueOrFunction instanceof Function
      ? findOrFilterByFunction('filter', key, valueOrFunction, options)
      : findOrFilter('filter', key, valueOrFunction, options);
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

    await removeIndexesForDocument(id, existingDocument);

    return db.del(id);
  }

  async function query(queryObject) {
    if (!isObject(queryObject)) {
      throw new Error('doubledb.query: queryObject must be an object');
    }

    let resultIds = new Set();
    let isFirstCondition = true;

    for (const [key, value] of Object.entries(queryObject)) {
      if (key === '$or') {
        const orResults = await Promise.all(value.map(subQuery => query(subQuery)));
        const orIds = new Set(orResults.flat().map(doc => doc.id));
        resultIds = isFirstCondition ? orIds : new Set([...resultIds].filter(id => orIds.has(id)));
      } else if (key.startsWith('$')) {
        throw new Error(`Unsupported top-level operator: ${key}`);
      } else {
        let ids;
        if (isObject(value) && Object.keys(value).some(k => k.startsWith('$'))) {
          ids = await handleOperators(key, value);
        } else {
          ids = await getIdsForKeyValue(key, value);
        }
        resultIds = isFirstCondition ? ids : new Set([...resultIds].filter(id => ids.has(id)));
      }
      isFirstCondition = false;
    }

    const results = await Promise.all([...resultIds].map(id => read(id)));
    return results.filter(doc => doc !== undefined);
  }

  async function handleOperators(key, operators) {
    let resultIds = new Set();
    let isFirstOperator = true;

    for (const [op, value] of Object.entries(operators)) {
      let ids;
      switch (op) {
        case '$eq':
          ids = await getIdsForKeyValue(key, value);
          break;
        case '$ne':
          ids = await getIdsForKeyValueNot(key, value);
          break;
        case '$gt':
        case '$gte':
        case '$lt':
        case '$lte':
          ids = await getIdsForKeyValueRange(key, op, value);
          break;
        case '$in':
          ids = await getIdsForKeyValueIn(key, value);
          break;
        case '$nin':
          ids = await getIdsForKeyValueNotIn(key, value);
          break;
        case '$all':
          ids = await getIdsForKeyValueAll(key, value);
          break;
        case '$exists':
          ids = await getIdsForKeyExists(key, value);
          break;
        case '$not':
          ids = await handleOperators(key, value);
          ids = await getAllIdsExcept(ids);
          break;
        default:
          // For unsupported operators, fall back to filtering all documents
          return getAllIds();
      }
      resultIds = isFirstOperator ? ids : new Set([...resultIds].filter(id => ids.has(id)));
      isFirstOperator = false;
    }

    return resultIds;
  }

  async function getIdsForKeyValue(key, value) {
    const ids = new Set();
    for await (const ckey of db.keys({
      gte: `indexes.${key}=${value}|`,
      lte: `indexes.${key}=${value}|${LastUnicodeCharacter}`
    })) {
      const id = await db.get(ckey);
      ids.add(id);
    }
    return ids;
  }

  async function getIdsForKeyValueNot(key, value) {
    const allIds = await getAllIds();
    const idsToExclude = await getIdsForKeyValue(key, value);
    return new Set([...allIds].filter(id => !idsToExclude.has(id)));
  }

  async function getIdsForKeyValueRange(key, op, value) {
    const ids = new Set();
    const query = {
      gte: `indexes.${key}=`,
      lte: `indexes.${key}=${LastUnicodeCharacter}`
    };

    for await (const ckey of db.keys(query)) {
      const [, lvalueAndKey] = ckey.split('=');
      const lvalue = lvalueAndKey.split('|')[0];
      const numericLvalue = Number(lvalue);

      if (!isNaN(numericLvalue)) {
        if ((op === '$gt' && numericLvalue > value) ||
            (op === '$gte' && numericLvalue >= value) ||
            (op === '$lt' && numericLvalue < value) ||
            (op === '$lte' && numericLvalue <= value)) {
          const id = await db.get(ckey);
          ids.add(id);
        }
      }
    }
    return ids;
  }

  async function getIdsForKeyValueIn(key, values) {
    const ids = new Set();
    for (const value of values) {
      const valueIds = await getIdsForKeyValue(key, value);
      valueIds.forEach(id => ids.add(id));
    }
    return ids;
  }

  async function getIdsForKeyValueAll(key, values) {
    const ids = new Set();
    const allValues = new Set(values);

    for await (const ckey of db.keys({
      gte: `indexes.${key}=`,
      lte: `indexes.${key}=${LastUnicodeCharacter}`
    })) {
      const [, lvalueAndKey] = ckey.split('=');
      const lvalue = lvalueAndKey.split('|')[0];
      const id = await db.get(ckey);

      if (!ids.has(id)) {
        const document = await read(id);
        const documentValues = document[key];
        if (Array.isArray(documentValues) && values.every(value => documentValues.includes(value))) {
          ids.add(id);
        }
      }
    }

    return ids;
  }

  async function getIdsForKeyValueNotIn(key, values) {
    const allIds = await getAllIds();
    const idsToExclude = await getIdsForKeyValueIn(key, values);
    return new Set([...allIds].filter(id => !idsToExclude.has(id)));
  }

  async function getIdsForKeyExists(key, shouldExist) {
    const ids = new Set();
    const query = {
      gte: `indexes.${key}=`,
      lt: `indexes.${key}=${LastUnicodeCharacter}`
    };
    for await (const ckey of db.keys(query)) {
      const id = await db.get(ckey);
      ids.add(id);
    }
    if (!shouldExist) {
      const allIds = await getAllIds();
      return new Set([...allIds].filter(id => !ids.has(id)));
    }
    return ids;
  }

  async function getAllIds() {
    const ids = new Set();
    for await (const key of db.keys({gte: '', lt: 'indexes'})) {
      ids.add(key);
    }
    return ids;
  }

  async function getAllIdsExcept(excludeIds) {
    const allIds = await getAllIds();
    return new Set([...allIds].filter(id => !excludeIds.has(id)));
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
    query,
    close: db.close.bind(db)
  };
}

export default createDoubleDb;
