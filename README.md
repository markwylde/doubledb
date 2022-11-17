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
doubledb.find('firstName', v => v.startsWith('J'));
doubledb.filter('firstName', 'Joe');
doubledb.filter('firstName', v => v.startsWith('J'));
doubledb.replace(record.id, { firstName: 'Joe', lastName: 'Bloggs' });
doubledb.patch(record.id, { firstName: 'Bob' });
doubledb.remove(record.id);
```

### Proposed Query
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