# CommonJS modules for Adobe® ExtendScript

Working in Adobe ExtendScript needn't mean you languish in ES3 like it's 1999.
Bring it into the dizzying future of 2011 with a CommonJS `require()` function
that understands `node_modules` and `package.json`.

## Usage

### 1. Include `commonjs.js` in your main script.

Use ExtendScript's own `#include` syntax extension to pull in `common.js`. The
path (unfortunately) must be specified directly, although it can be relative to
the main script file. Do this at the very top. It can follow an opening IIFE
wrapper if that's your thing.

For example, if you got this module through `npm`, and your main script was in
the same directory as your `node_modules`, it might look like this:
```
#include "./node_modules/@yellcorp/extendscript-commonjs/common.js"
```

### 2. Call `require.init($.fileName)` from your main script.

The non-standard method `init` tells the require system where it's running, so
it can resolve paths and search for `node_modules` directories and so on. Do
this on the line following the `#include` from the previous step. Always pass
`$.fileName` as the argument.
```
require.init($.fileName);
```

Failure to call `require.init` will cause a call to `require()` to throw an
Error.  Doing this twice or more will immediately throw an Error.

### 3. Use it

You can then call `require("module/path")` as you normally would.

## TODO

* Document other custom methods on `require`
* Document presence of ES5 shim and JSON.parse/stringify
* Tutorial: suggest a bootstrap `.jsx` file to contain the require init
  (example in `test/run.jsx`)
* Handle cycles
* Expose `require.resolve` like Node?

## License

Copyright (c) 2017 Jim Boswell.  Licensed under the Expat MIT license.  See the
file LICENSE for the full text.
