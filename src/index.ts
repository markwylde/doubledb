import { promises as fs } from 'fs';
import { Level } from 'level';
import { v4 as uuid } from 'uuid';

export const FirstUnicodeCharacter = '\u{0000}';
export const LastUnicodeCharacter = '\u{10FFFF}';

type Document = {
  id?: string;
  [key: string]: any;
}

type QueryOptions = {
  skip?: number;
  limit?: number;
  gt?: string;
  lt?: string;
  lte?: string;
  gte?: string;
  sort?: { [key: string]: 1 | -1 };
  project?: { [key: string]: 1 };
}

export type DoubleDb = {
  _level: Level<string, string>;
  find: (key: string, valueOrFunction: any, options?: QueryOptions) => Promise<Document | undefined>;
  filter: (key: string, valueOrFunction: any, options?: QueryOptions) => Promise<Document[]>;
  insert: (document: Document) => Promise<Document>;
  replace: (id: string, newDocument: Document) => Promise<Document>;
  patch: (id: string, newDocument: Partial<Document>) => Promise<Document>;
  remove: (id: string) => Promise<void>;
  read: (id: string) => Promise<Document | undefined>;
  query: (queryObject?: object, options?: { limit?: number; offset?: number; sort?: { [key: string]: 1 | -1 }; project?: { [key: string]: 1 } }) => Promise<Document[]>;
  count: (queryObject?: object) => Promise<number>;
  close: () => Promise<void>;
  batchInsert: (documents: Document[]) => Promise<Document[]>;
  upsert: (id: string, document: Document) => Promise<Document>;
}

function notFoundToUndefined(error: Error & { code?: string }): undefined {
  if (error.code === 'LEVEL_NOT_FOUND') {
    return undefined;
  }
  throw error;
}

const isObject = (thing: any): thing is object => thing instanceof Object && !Array.isArray(thing);

async function createDoubleDb(dataDirectory: string): Promise<DoubleDb> {
  await fs.mkdir(dataDirectory, { recursive: true });

  const db = new Level<string, string>(dataDirectory);

  async function incrementCount(prefix: string, key: string, value: any): Promise<void> {
    const countKey = `counts${prefix}.${key}=${value}`;

    // Use atomic get-and-update
    while (true) {
      try {
        let currentCount;
        try {
          currentCount = await db.get(countKey).then(Number);
          if (isNaN(currentCount)) {
            currentCount = 0;
          }
        } catch (error) {
          if (error.code === 'LEVEL_NOT_FOUND') {
            currentCount = 0;
          } else {
            throw error;
          }
        }

        const newCount = currentCount + 1;
        await db.put(countKey, newCount.toString());
        break;
      } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
          await db.put(countKey, '1');
          break;
        }
        // If we get a conflict, retry
        if (error.code === 'LEVEL_LOCKED') {
          continue;
        }
        console.error('ERROR in incrementCount:', error);
        throw error;
      }
    }
  }

  async function decrementCount(prefix: string, key: string, value: any): Promise<void> {
    const countKey = `counts${prefix}.${key}=${value}`;
    const currentCount = await db.get(countKey).then(Number).catch(() => 0);
    const newCount = currentCount - 1;

    if (newCount > 0) {
      await db.put(countKey, newCount.toString());
    } else {
      await db.del(countKey).catch(() => {}); // Ignore if key doesn't exist
    }
  }

  async function addToIndexes(id: string, object: object, prefix: string = ''): Promise<void> {
    const promises: Promise<void>[] = [];

    const addIndex = async (key: string, value: any): Promise<void> => {
      const indexKey = 'indexes' + prefix + '.' + key + '=' + value + '|' + id;
      promises.push(db.put(indexKey, id));
      promises.push(incrementCount(prefix, key, value));
    };

    for (const [key, value] of Object.entries(object)) {
      if (isObject(value)) {
        // For nested objects, both add indexes for the nested fields
        // and create an index for the full path
        promises.push(addToIndexes(id, value, prefix + '.' + key));
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (!isObject(nestedValue)) {
            const fullKey = `${key}.${nestedKey}`;
            promises.push(addIndex(fullKey, nestedValue));
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach(item => promises.push(addIndex(key, item)));
      } else {
        promises.push(addIndex(key, value));
      }
    }

    await Promise.all(promises);
  }

  async function removeIndexesForDocument(id: string, document: string | object, prefix: string = ''): Promise<void> {
    const parsedDocument = typeof document === 'string' ? JSON.parse(document) : document;
    const promises: Promise<void>[] = [];

    const removeIndex = async (key: string, value: any): Promise<void> => {
      const indexKey = 'indexes' + prefix + '.' + key + '=' + value + '|' + id;
      promises.push(db.del(indexKey).catch(() => {}));
      promises.push(decrementCount(prefix, key, value));
    };

    for (const [key, value] of Object.entries(parsedDocument)) {
      if (isObject(value)) {
        // Remove indexes for both nested fields and full paths
        promises.push(removeIndexesForDocument(id, value, prefix + '.' + key));
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (!isObject(nestedValue)) {
            const fullKey = `${key}.${nestedKey}`;
            promises.push(removeIndex(fullKey, nestedValue));
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach(item => promises.push(removeIndex(key, item)));
      } else {
        promises.push(removeIndex(key, value));
      }
    }

    await Promise.all(promises);
  }

  async function insert(document: Document): Promise<Document> {
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
    await incrementCount('', '__total__', 'documents');

    return puttableRecord;
  }

  async function replace(id: string, newDocument: Document): Promise<Document> {
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

  async function patch(id: string, newDocument: Partial<Document>): Promise<Document> {
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

  async function read(id: string): Promise<Document | undefined> {
    const document = await db.get(id)
      .catch(notFoundToUndefined);

    if (!document) {
      return undefined;
    }

    return JSON.parse(document);
  }

  async function findOrFilter(type: 'find' | 'filter', key: string, value: any, options?: QueryOptions): Promise<Document | Document[] | undefined> {
    options = {
      skip: 0,
      limit: type === 'find' ? 1 : Infinity,
      ...options
    };
    const promises: Promise<Document | undefined>[] = [];
    let skipIndex = 0;
    for await (const ckey of db.keys({
      gt: `indexes.${key}=${value}|`,
      lte: `indexes.${key}=${value}|${LastUnicodeCharacter}`
    })) {
      const [, lvalueAndKey] = ckey.split('=');
      const lvalue = lvalueAndKey.split('|')[0];

      if (lvalue == value) {
        if (skipIndex < options.skip!) {
          skipIndex = skipIndex + 1;
          continue;
        }

        const id = await db.get(ckey);
        promises.push(read(id));
        if (type === 'find') {
          break;
        }

        if (promises.length >= options.limit!) {
          break;
        }
      }
    }

    const results = await Promise.all(promises);
    if (type === 'filter') {
      return results.filter((doc): doc is Document => doc !== undefined);
    } else {
      return results[0];
    }
  }

  async function findOrFilterByFunction(type: 'find' | 'filter', key: string, fn: (value: any) => boolean, options?: QueryOptions): Promise<Document | Document[] | undefined> {
    options = {
      skip: 0,
      limit: type === 'find' ? 1 : Infinity,
      gt: options?.gt,
      lt: options?.lt,
      lte: options?.lte,
      gte: options?.gte,
      ...options
    };
    const promises: Promise<Document | undefined>[] = [];
    let skipIndex = 0;

    const query: { [key: string]: string } = {};

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
        if (skipIndex < options.skip!) {
          skipIndex = skipIndex + 1;
          continue;
        }

        const id = await db.get(ckey);
        promises.push(read(id));
        if (type === 'find') {
          break;
        }

        if (promises.length >= options.limit!) {
          break;
        }
      }
    }

    const results = await Promise.all(promises);
    if (type === 'filter') {
      return results.filter((doc): doc is Document => doc !== undefined);
    } else {
      return results[0];
    }
  }

  async function find(key: string, valueOrFunction: any, options?: QueryOptions): Promise<Document | undefined> {
    return valueOrFunction instanceof Function
      ? findOrFilterByFunction('find', key, valueOrFunction, options) as Promise<Document | undefined>
      : findOrFilter('find', key, valueOrFunction, options) as Promise<Document | undefined>;
  }

  async function filter(key: string, valueOrFunction: any, options?: QueryOptions): Promise<Document[]> {
    return valueOrFunction instanceof Function
      ? findOrFilterByFunction('filter', key, valueOrFunction, options) as Promise<Document[]>
      : findOrFilter('filter', key, valueOrFunction, options) as Promise<Document[]>;
  }

  async function remove(id: string): Promise<void> {
    if (!id) {
      throw new Error('doubledb.remove: no id was supplied to replace function');
    }

    const existingDocument = await db.get(id)
      .catch(notFoundToUndefined);

    if (!existingDocument) {
      throw new Error(`doubledb.remove: document with id ${id} does not exist`);
    }

    await removeIndexesForDocument(id, existingDocument);
    await decrementCount('', '__total__', 'documents');
    return db.del(id);
  }

  async function getCountForKeyValue(prefix: string, key: string, value: any): Promise<number> {
    const countKey = `counts${prefix}.${key}=${value}`;
    try {
      const rawCount = await db.get(countKey);
      const count = Number(rawCount);
      if (isNaN(count)) {
        return 0;
      }
      return count;
    } catch (error) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return 0;
      }
      console.error('ERROR in getCountForKeyValue:', error);
      return 0;
    }
  }

  async function getTotalCount(): Promise<number> {
    try {
      const count = await getCountForKeyValue('', '__total__', 'documents');
      if (isNaN(count)) {
        console.log('WARNING: getTotalCount returned NaN, defaulting to 0');
        return 0;
      }
      return count;
    } catch (error) {
      console.log('ERROR in getTotalCount:', error);
      return 0;
    }
  }

  async function getCountForOperators(prefix: string, key: string, operators: object): Promise<number> {
    let totalCount = 0;
    let isFirstOperator = true;

    for (const [op, value] of Object.entries(operators)) {
      let count;
      switch (op) {
        case '$eq':
          count = await getCountForKeyValue(prefix, key, value);
          break;
        case '$ne':
          count = await getTotalCount();
          const excludeCount = await getCountForKeyValue(prefix, key, value);
          count = count - excludeCount;
          break;
        case '$in':
          count = 0;
          for (const val of value as any[]) {
            count += await getCountForKeyValue(prefix, key, val);
          }
          break;
        case '$nin':
          count = await getTotalCount();
          for (const val of value as any[]) {
            count -= await getCountForKeyValue(prefix, key, val);
          }
          break;
        case '$exists':
          if (value) {
            count = await sumCountsForPrefix(`counts${prefix}.${key}=`);
          } else {
            count = await getTotalCount() - await sumCountsForPrefix(`counts${prefix}.${key}=`);
          }
          break;
        default:
          // Fall back to ID collection for unsupported operators
          const ids = await handleOperators(key, { [op]: value });
          count = ids.size;
          break;
      }
      totalCount = isFirstOperator ? count : Math.min(totalCount, count);
      isFirstOperator = false;
    }

    return totalCount;
  }

  async function sumCountsForPrefix(prefix: string): Promise<number> {
    let sum = 0;
    for await (const [, value] of db.iterator({
      gte: prefix,
      lt: prefix + LastUnicodeCharacter
    })) {
      sum += Number(value);
    }
    return sum;
  }

  async function count(queryObject?: object): Promise<number> {
    if (!queryObject || Object.keys(queryObject).length === 0) {
      return getTotalCount();
    }

    let totalCount = 0;
    let isFirstCondition = true;

    for (const [key, value] of Object.entries(queryObject)) {
      if (key === '$or') {
        const uniqueIds = new Set<string>();
        for (const subQuery of value as object[]) {
          const subQueryIds = await getAllIdsForQuery(subQuery);
          subQueryIds.forEach(id => uniqueIds.add(id));
        }
        const orCount = uniqueIds.size;
        totalCount = isFirstCondition ? orCount : Math.min(totalCount, orCount);
      } else if (key.startsWith('$')) {
        throw new Error(`Unsupported top-level operator: ${key}`);
      } else {
        let fieldCount;
        if (isObject(value) && Object.keys(value).some(k => k.startsWith('$'))) {
          fieldCount = await getCountForOperators('', key, value as object);
        } else {
          fieldCount = await getCountForKeyValue('', key, value);
        }
        totalCount = isFirstCondition ? fieldCount : Math.min(totalCount, fieldCount);
      }
      isFirstCondition = false;
    }

    return totalCount;
  }

  async function query(queryObject?: object, options?: { limit?: number; offset?: number; sort?: { [key: string]: 1 | -1 }; project?: { [key: string]: 1 } }): Promise<Document[]> {
    if (!queryObject || Object.keys(queryObject).length === 0) {
      queryObject = { id: { $exists: true } };
    }

    let resultIds = new Set<string>();
    let isFirstCondition = true;

    for (const [key, value] of Object.entries(queryObject)) {
      if (key === '$or') {
        const orResults = await Promise.all((value as object[]).map(subQuery => query(subQuery)));
        const orIds = new Set(orResults.flat().map(doc => doc.id));
        resultIds = isFirstCondition ? orIds : new Set([...resultIds].filter(id => orIds.has(id)));
      } else if (key.startsWith('$')) {
        throw new Error(`Unsupported top-level operator: ${key}`);
      } else {
        let ids;
        if (isObject(value) && Object.keys(value).some(k => k.startsWith('$'))) {
          ids = await handleOperators(key, value as object);
        } else {
          ids = await getIdsForKeyValue(key, value);
        }
        resultIds = isFirstCondition ? ids : new Set([...resultIds].filter(id => ids.has(id)));
      }
      isFirstCondition = false;
    }

    let results = await Promise.all([...resultIds].map(id => read(id)));
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? results.length;

    if (options?.sort) {
      const sortFields = Object.entries(options.sort);
      results.sort((a, b) => {
        for (const [field, direction] of sortFields) {
          if (a[field] < b[field]) return direction === 1 ? -1 : 1;
          if (a[field] > b[field]) return direction === 1 ? 1 : -1;
        }
        return 0;
      });
    }

    if (options?.project) {
      results = results.map(doc => {
        const projected: Document = {};
        for (const field of Object.keys(options.project)) {
          if (field in doc) {
            projected[field] = doc[field];
          }
        }
        return projected;
      });
    }

    return results.filter((doc): doc is Document => doc !== undefined).slice(offset, offset + limit);
  }

  async function batchInsert(documents: Document[]): Promise<Document[]> {
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error('doubledb.batchInsert: documents must be a non-empty array');
    }

    const idsToRollback = new Set<string>();
    try {
      const ops: { type: 'put'; key: string; value: string }[] = [];
      const processedDocs: Document[] = [];

      for (const doc of documents) {
        const id = doc.id || uuid();
        const puttableRecord = { id, ...doc };
        ops.push({ type: 'put', key: id, value: JSON.stringify(puttableRecord) });
        processedDocs.push(puttableRecord);
        idsToRollback.add(id);
      }

      // First, batch insert all documents
      await db.batch(ops);

      // Process indexes and counts sequentially to avoid race conditions
      for (const doc of processedDocs) {
        await addToIndexes(doc.id!, doc);
      }

      // Update the total count once with the total number of documents
      const currentTotal = await getTotalCount();
      await db.put('counts.__total__=documents', (currentTotal + documents.length).toString());

      return processedDocs;
    } catch (error) {
      // Attempt to rollback
      try {
        for (const id of idsToRollback) {
          const doc = await read(id).catch((): undefined => undefined);
          if (doc) {
            await removeIndexesForDocument(id, doc);
            await db.del(id).catch((): void => {});
          }
        }
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
      throw error;
    }
  }

  async function upsert(id: string, document: Document): Promise<Document> {
    if (!id) {
      throw new Error('doubledb.upsert: no id was supplied to upsert function');
    }

    if (!document) {
      throw new Error('doubledb.upsert: no document was supplied to upsert function');
    }

    const existingDocument = await db.get(id).catch(notFoundToUndefined);

    if (existingDocument) {
      await removeIndexesForDocument(id, existingDocument);
    } else {
      await incrementCount('', '__total__', 'documents');
    }

    const puttableRecord = {
      ...JSON.parse(existingDocument || '{}'),
      ...document,
      id
    };

    await db.put(id, JSON.stringify(puttableRecord));
    await addToIndexes(id, puttableRecord);

    return puttableRecord;
  }

  async function handleOperators(key: string, operators: object): Promise<Set<string>> {
    let resultIds = new Set<string>();
    let isFirstOperator = true;

    for (const [op, value] of Object.entries(operators)) {
      let ids: Set<string>;
      try {
        switch (op) {
          case '$eq':
            ids = await getIdsForKeyValue(key, value);
            break;

          case '$ne':
            const allIdsNe = await getAllIds();
            const matchingIdsNe = await getIdsForKeyValue(key, value);
            ids = new Set([...allIdsNe].filter(id => !matchingIdsNe.has(id)));
            break;

          case '$gt':
          case '$gte':
          case '$lt':
          case '$lte':
            if (value === null || value === undefined) {
              throw new Error(`${op} operator requires a non-null value`);
            }
            // Convert dates to comparable format
            const compareValue = value instanceof Date ? value.toISOString() : value;
            ids = await getIdsForKeyValueRange(key, op, compareValue);
            break;

          case '$in':
            if (!Array.isArray(value)) {
              throw new Error('$in operator requires an array');
            }
            if (value.length === 0) {
              ids = new Set<string>(); // Empty array means no matches
            } else {
              ids = await getIdsForKeyValueIn(key, value);
            }
            break;

          case '$nin':
            if (!Array.isArray(value)) {
              throw new Error('$nin operator requires an array');
            }
            if (value.length === 0) {
              ids = await getAllIds(); // Empty array means all documents match
            } else {
              ids = await getIdsForKeyValueNotIn(key, value);
            }
            break;

          case '$exists':
            if (typeof value !== 'boolean') {
              throw new Error('$exists operator requires a boolean value');
            }
            ids = await getIdsForKeyExists(key, value);
            break;

          case '$all':
            if (!Array.isArray(value)) {
              throw new Error('$all operator requires an array');
            }
            if (value.length === 0) {
              ids = await getAllIds(); // Empty array means all documents match
            } else {
              ids = await getIdsForKeyValueAll(key, value);
            }
            break;

          case '$not':
            if (value === null || value === undefined) {
              throw new Error('$not operator requires a non-null value');
            }
            if (isObject(value)) {
              const matchingIds = await handleOperators(key, value as object);
              const allIds = await getAllIds();
              ids = new Set([...allIds].filter(id => !matchingIds.has(id)));
            } else {
              ids = await getIdsForKeyValueNot(key, value);
            }
            break;

          case '$sw':
            if (typeof value !== 'string') {
              throw new Error('$sw operator requires a string value');
            }
            ids = await getIdsForKeyValueStartsWith(key, value);
            break;

          default:
            throw new Error(`Unsupported operator: ${op}`);
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Error processing ${op} operator for key ${key}: ${error.message}`);
        }
        throw error;
      }

      resultIds = isFirstOperator ? ids : new Set([...resultIds].filter(id => ids.has(id)));
      isFirstOperator = false;
    }

    return resultIds;
  }

  async function getIdsForKeyValue(key: string, value: any): Promise<Set<string>> {
    const ids = new Set<string>();
    for await (const ckey of db.keys({
      gte: `indexes.${key}=${value}|`,
      lte: `indexes.${key}=${value}|${LastUnicodeCharacter}`
    })) {
      const id = await db.get(ckey);
      ids.add(id);
    }
    return ids;
  }

  async function getIdsForKeyValueStartsWith(key: string, prefix: string): Promise<Set<string>> {
    const ids = new Set<string>();
    for await (const ckey of db.keys({
      gte: `indexes.${key}=${prefix}`,
      lt: `indexes.${key}=${prefix}${LastUnicodeCharacter}`
    })) {
      const id = await db.get(ckey);
      ids.add(id);
    }
    return ids;
  }

  async function getIdsForKeyValueNot(key: string, value: any): Promise<Set<string>> {
    const allIds = await getAllIds();
    const idsToExclude = await getIdsForKeyValue(key, value);
    return new Set([...allIds].filter(id => !idsToExclude.has(id)));
  }

  async function getIdsForKeyValueRange(key: string, op: string, value: number): Promise<Set<string>> {
    const ids = new Set<string>();
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

  async function getIdsForKeyValueIn(key: string, values: any[]): Promise<Set<string>> {
    const ids = new Set<string>();
    for (const value of values) {
      const valueIds = await getIdsForKeyValue(key, value);
      valueIds.forEach(id => ids.add(id));
    }
    return ids;
  }

  async function getIdsForKeyValueAll(key: string, values: any[]): Promise<Set<string>> {
    const ids = new Set<string>();

    for await (const ckey of db.keys({
      gte: `indexes.${key}=`,
      lte: `indexes.${key}=${LastUnicodeCharacter}`
    })) {
      const [, lvalueAndKey] = ckey.split('=');
      const lvalue = lvalueAndKey.split('|')[0];
      const id = await db.get(ckey);

      if (!ids.has(id)) {
        const document = await read(id);
        const documentValues = document?.[key];
        if (Array.isArray(documentValues) && values.every(value => documentValues.includes(value))) {
          ids.add(id);
        }
      }
    }

    return ids;
  }

  async function getIdsForKeyValueNotIn(key: string, values: any[]): Promise<Set<string>> {
    const allIds = await getAllIds();
    const idsToExclude = await getIdsForKeyValueIn(key, values);
    return new Set([...allIds].filter(id => !idsToExclude.has(id)));
  }

  async function getIdsForKeyExists(key: string, shouldExist: boolean): Promise<Set<string>> {
    const ids = new Set<string>();
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

  async function getAllIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    for await (const key of db.keys({
      // Only get keys that don't start with 'indexes' or 'counts'
      gt: '\x00',
      lt: 'counts'
    })) {
      // Additional check to ensure we only get document IDs
      if (!key.startsWith('indexes') && !key.startsWith('counts')) {
        ids.add(key);
      }
    }
    return ids;
  }

  // Helper function for count to get all matching IDs for a query
  async function getAllIdsForQuery(queryObject: object): Promise<Set<string>> {
    let resultIds = new Set<string>();
    let isFirstCondition = true;

    for (const [key, value] of Object.entries(queryObject)) {
      if (key === '$or') {
        const orResults = new Set<string>();
        for (const subQuery of value as object[]) {
          const subQueryIds = await getAllIdsForQuery(subQuery);
          subQueryIds.forEach(id => orResults.add(id));
        }
        resultIds = isFirstCondition ? orResults : new Set([...resultIds].filter(id => orResults.has(id)));
      } else if (key.startsWith('$')) {
        throw new Error(`Unsupported top-level operator: ${key}`);
      } else {
        let ids;
        if (isObject(value) && Object.keys(value).some(k => k.startsWith('$'))) {
          ids = await handleOperators(key, value as object);
        } else {
          ids = await getIdsForKeyValue(key, value);
        }
        resultIds = isFirstCondition ? ids : new Set([...resultIds].filter(id => ids.has(id)));
      }
      isFirstCondition = false;
    }

    return resultIds;
  }

  async function getAllIdsExcept(excludeIds: Set<string>): Promise<Set<string>> {
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
    count,
    close: db.close.bind(db),
    batchInsert,
    upsert
  };
}

export default createDoubleDb;
