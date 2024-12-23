# doubledb

An on disk database that indexes everything for fast querying.

## Installation
```bash
npm install --save doubledb
```

## Usage
```javascript
import createDoubledb from 'doubledb';
const doubledb = await createDoubledb('./data');

doubledb.insert({
  id: undefined, // defaults to uuid, must be unique
  firstName: 'Joe',
  lastName: 'Bloggs',
  stats: {
    wins: 10,
    loses: 5
  },
  skills: ['cooking', 'running']
});

doubledb.read(record.id);
doubledb.find('firstName', 'Joe');
doubledb.find('stats.wins', 10);
doubledb.find('skills', 'cooking');
doubledb.find('firstName', v => v.startsWith('J'), { skip: 20, gt: 'J', lt: 'K' });
doubledb.filter('firstName', 'Joe');
doubledb.filter('firstName', v => v.startsWith('J'));
doubledb.filter('firstName', v => v.startsWith('J'), { limit: 10, skip: 20, gt: 'J', lt: 'K' });
doubledb.upsert(record.id, { firstName: 'Joe', lastName: 'Bloggs' });
doubledb.replace(record.id, { firstName: 'Joe', lastName: 'Bloggs' });
doubledb.patch(record.id, { firstName: 'Bob' });
doubledb.remove(record.id);

// Batch insert multiple documents for better performance
doubledb.batchInsert([
  { firstName: 'Alice', lastName: 'Smith' },
  { firstName: 'Bob', lastName: 'Johnson' },
  { firstName: 'Charlie', lastName: 'Brown' }
]);
```

### `.read(id)`
Get a single record by it's `.id` property.

If a record is found, the whole record will be returned.
If no record is found, `undefined` will be returned.

### `.find(field, value, { skip })`
Quickly find a single record by any field (`use.dot.notation.for.nested.properties`) and it's exact value.

If multiple records exist, a `skip` option can be provided to ignore the first `number` of finds.

If a record is found, the whole record will be returned.
If no record is found, `undefined` will be returned.

### `.find(field, matcherFunction: (value: string) => boolean), { limit, skip, gt, lt, gte, lte })`
Slow find a single record by any field and test against a `matcherFunction`.

If multiple records exist:
- a `skip` option can be provided to ignore the first `number` of finds.
- a `limit` option can be provided to stop after `number` of finds.

Find using a matcherFunction will work without a `gt` and `lt`, but the indexing will be pretty useless, as it will need to scan every single record.

You should provide a `gt` and/or `lt` to let the indexer know where to begin/end.

For example, the query below will scan every first name from `A` all the way to `Z`

```javascript
doubledb.find('firstName', v => v.startsWith('Jo'))
```

Let's tell it to start from `Jo`.

```javascript
doubledb.find('firstName', v => v.startsWith('Jo'), { gt: 'Jo' })
```

This will skip all indexes lower than `Jo`. However if it can't find any records, it will keep checking, even if the `firstName` is `Zelda`

So we should help the indexer by giving it a `lt`.

```javascript
doubledb.find('firstName', v => v.startsWith('Jo'), { gt: 'Jo', lt: 'K' })
```

Let's look at some more examples:

```javascript
doubledb.find('favouriteNumber', v => v > 5 && v < 10, { gt: 5, lt: 10 })
doubledb.find('firstName', v => ['Dave', 'Peter'].includes(v), { gt: 'Dave', lte: 'Peter' })
```

If a record is found, the whole record will be returned.
If no record is found, `undefined` will be returned.

### `.filter(field, matcherFunction: (value: string) => boolean), { limit, skip, gt, lt, gte, lte })`
This works the exact same as `.find` but will return an array.

If records are found, an array will be returned containing every complete found record.
If no records are found, an empty array will be returned.

### `.replace(key, object)`
Completely replace a key with a new object, losing all previous fields in the record.

### `.patch(key, object)`
Merge the new object in with the existing record.

For example, if the following record exists:

```json
{
  "id": "1",
  "firstName": "Joe",
  "lastName": "Bloggs"
}
```

And you run the following `.patch`.

```javascript
doubledb.patch('1', { fullName: 'Joe Bloggs' })
```

The final record will be:

```json
{
  "id": "1",
  "firstName": "Joe",
  "lastName": "Bloggs",
  "fullName": "Joe Bloggs"
}
```

### `.remove(key)`
Query the database using a complex query object. This method allows for advanced querying using a combination of fields and operators.

### `.query(queryObject)`
Query the database using a complex query object. This method allows for advanced querying using a combination of fields and operators.

**Example:**
```javascript
const records = await doubledb.query({
  location: 'London',
  category: 'b',
  $or: [
    { firstName: { $eq: 'Joe' } },
    { firstName: { $eq: 'joe' } }
  ]
});
```

The `queryObject` can contain various fields and operators to filter the records. The following operators are supported:

#### Operators:
- `$eq`: Equal to a value.
- `$ne`: Not equal to a value.
- `$gt`: Greater than a value.
- `$gte`: Greater than or equal to a value.
- `$lt`: Less than a value.
- `$lte`: Less than or equal to a value.
- `$in`: Value is in the provided array.
- `$nin`: Value is not in the provided array.
- `$all`: Array contains all the provided values.
- `$exists`: Field exists or does not exist.
- `$not`: Negates the condition.

**Example Usage of Operators:**
```javascript
const records = await doubledb.query({
  age: { $gte: 18, $lt: 30 },
  status: { $in: ['active', 'pending'] },
  $or: [
    { role: { $eq: 'admin' } },
    { role: { $eq: 'user' } }
  ],
  preferences: { $exists: true }
});
```

### How Operators Work:
- **$eq**: Matches documents where the field is equal to the specified value.
- **$ne**: Matches documents where the field is not equal to the specified value.
- **$gt / $gte**: Matches documents where the field is greater than (or greater than or equal to) the specified value.
- **$lt / $lte**: Matches documents where the field is less than (or less than or equal to) the specified value.
- **$in**: Matches documents where the field value is in the specified array.
- **$nin**: Matches documents where the field value is not in the specified array.
- **$all**: Matches documents where the array field contains all the specified values.
- **$exists**: Matches documents where the field exists (or does not exist if set to false).
- **$not**: Matches documents that do not match the specified condition.

This query method is powerful and allows combining multiple conditions and operators to fetch the desired records from the database.

### `.batchInsert(documents)`
Insert multiple documents at once for better performance.

**Example:**
```javascript
await doubledb.batchInsert([
  { firstName: 'Alice', lastName: 'Smith' },
  { firstName: 'Bob', lastName: 'Johnson' },
  { firstName: 'Charlie', lastName: 'Brown' }
]);
```

If the documents are successfully inserted, an array of the inserted documents will be returned.
If the documents array is empty, an error will be thrown.
