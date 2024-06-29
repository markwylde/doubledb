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

    return db.del(id);
  }

  function applyMqlOperators(operators, value) {
    for (const operator in operators) {
      const operatorValue = operators[operator];
      switch (operator) {
        case '$eq':
          if (typeof value === 'string' && typeof operatorValue === 'string') {
            if (value.toLowerCase() !== operatorValue.toLowerCase()) return false;
          } else {
            if (value !== operatorValue) return false;
          }
          break;
        // Add other operators as needed
        default:
          throw new Error(`Unknown operator: ${operator}`);
      }
    }
    return true;
  }

  async function applyQueryToResults(results, queryObject) {
    const keys = Object.keys(queryObject);
    let filteredResults = results;

    for (const key of keys) {
      const value = queryObject[key];
      if (key === '$or') {
        if (!Array.isArray(value)) {
          throw new Error('doubledb.query: value for $or must be an array');
        }
        const orResults = await Promise.all(value.map(async subQuery => {
          return await applyQueryToResults(filteredResults, subQuery);
        }));
        filteredResults = [...new Set([].concat(...orResults))];
      } else if (key.startsWith('$')) {
        throw new Error(`Unknown special operator: ${key}`);
      } else {
        const isOperator = isObject(value) && Object.keys(value).some(k => k.startsWith('$'));
        if (isOperator) {
          filteredResults = filteredResults.filter(
            record => applyMqlOperators(value, record[key])
          );
        } else {
          filteredResults = filteredResults.filter(record => record[key] === value);
        }
      }
    }

    return filteredResults;
  }

  async function query(queryObject) {
    if (!isObject(queryObject)) {
      throw new Error('doubledb.query: queryObject must be an object');
    }

    const allKeys = await db.keys({gte: '', lt: 'indexes.'}).all();
    let results = await Promise.all(allKeys.map(key => read(key)));

    results = await applyQueryToResults(results, queryObject);
    return results;
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
