# AWS Config

Service Configuration management package utilizing S3 and Secrets Manager.

- Uses `NODE_ENV` to get the configuration key for the specified environment.
  - Secrets in the form of `[environment]_[key]`.
  - Configurations from the `configs/[environment]` bucket.

## Usage

### Getting configuration values

> **If `process.env.NODE_ENV === 'local'`**
> AWS Config will just return a result set based on the current `process.env` and will not attempt to go to
> AWS to fetch the keys. This is to allow for `.env` files to be used during development.

```javascript
const config = require("aws-config");
const configKeys = ["key1", "key2"];
const secretKeys = ["secret1", "secret2"];

config
  .get({
    secretKeys,
    configKeys,
    setEnvironment: true // optional, default false. Sets the values as env vars.
  })
  .then(values => {
    console.log(secrets);
    /*
    [
        {
            name: 'secret1',
            value: 'value1',
        },
        {
            name: 'secret2',
            value: 'value2',
        },
        {
            name: 'key1',
            value: 'value1',
        },
        {
            name: 'key2',
            value: 'value2',
        }
    ]
    */
  })
  .catch(err => {
    throw err;
  });
```

### Setting configration values

> **PLEASE NOTE**: if you provide the `set` function a JSON value, it will attempt to stringify it.
> When you retrieve this secret/config back using `get`, make sure to `JSON.parse()` it!

```javascript
const config = require("aws-config");
const configPairs = [{name: 'config1', value: 'value1'}];
const secretPairs = [{name: 'secret1', value: {val1: 'something'}];

config
  .set({
    configPairs,
    secretPairs,
  })
  .then(() => {
    /* APP LOGIC */
  })
  .catch(err => {
    throw err;
  });
```
