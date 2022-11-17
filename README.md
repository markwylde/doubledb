# doubledb
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/markwylde/doubledb?style=flat-square)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/markwylde/doubledb?style=flat-square)](https://github.com/markwylde/doubledb/blob/master/package.json)
[![GitHub](https://img.shields.io/github/license/markwylde/doubledb?style=flat-square)](https://github.com/markwylde/doubledb/blob/master/LICENSE)
[![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg?style=flat-square)](https://github.com/standard/semistandard)

An on disk database that indexes everything for fast querying.

## Installation
```bash
npm install --save doubledb
```

## Features
- [x]  read
- [x]  insert
- [x]  replace
- [x]  patch
- [x]  remove
- [x]  find
- [x]  filter
- [ ]  query

## Usage
```javascript
import createDoubledb from 'doubledb';
const doubledb = createDoubledb('./data');

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

doubledb.get(record.id);
doubledb.find('firstName', 'Joe');
doubledb.find('stats.wins', 10);
doubledb.find('skills', 'cooking');
doubledb.find('firstName', v => v.startsWith('J'), { skip: 20, gt: 'J', lt: 'K' });
doubledb.filter('firstName', 'Joe');
doubledb.filter('firstName', v => v.startsWith('J'));
doubledb.filter('firstName', v => v.startsWith('J'), { limit: 10, skip: 20, gt: 'J', lt: 'K' });
doubledb.replace(record.id, { firstName: 'Joe', lastName: 'Bloggs' });
doubledb.patch(record.id, { firstName: 'Bob' });
doubledb.remove(record.id);
```

### `.get(id)`
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
Completely remove the key and it's value from the database.

### Proposed Query
This hasn't been implemented yet, but it's something I'd like and think could work.

```javascript
const record = doubledb.query({
  location: 'London',
  category: 'b',

  $or: {
    firstName: {
      $eq: 'Joe',
    },
    firstName: {
      $eq: 'joe',
    }
  }
})
```