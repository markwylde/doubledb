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

## Usage
```javascript
const createDoubled = require('doubledb')
const doubled = doubled('./data')

doubled.insert({
  id: undefined, // defaults to uuid, must be unique
  firstName: 'Joe',
  lastName: 'Bloggs'
})

const record = doubled.find({
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

doubled.replace(record.id, { firstName: 'Joe', lastName: 'Bloggs' })
doubled.patch(record.id, { firstName: 'Bob' })
doubled.delete(record.id)
```
