/*global
  $,
  File,
  Folder
*/
(function (topScope) {
"use strict";


var platformId;
var moduleSearchPaths = [ ];


var hasOwn = Object.prototype.hasOwnProperty;


function constFunction(value) {
  return function () {
    return value;
  };
}


var log;
var logging = {
  setLogFunction: function (newFunc) {
    // if passed $.writeln or $.write, swap it for a bound version, because of
    // course the built-in functions break if you separate them from the $
    // object
    switch (newFunc) {
    case $.writeln:
    case true:
      newFunc = logging.writeln;
      break;
    case $.write:
      newFunc = logging.write;
      break;
    case null:
    case undefined:
    case false:
      newFunc = logging.noop;
      break;
    }

    log = newFunc;
  },

  writeln: function () {
    $.writeln.apply($, arguments);
  },

  write: function () {
    $.write.apply($, arguments);
  },

  noop: function () { }
};
logging.setLogFunction(logging.writeln);


var EITHER_SLASH = /[\x2F\x5C]/g;
var pathutil = {
  init: function (platform) {
    function genericNormalize(root, parts, separator) {
      var normParts = [ ];
      var partsLen = parts.length;
      for (var i = 0; i < partsLen; i++) {
        var part = parts[i];
        switch (part) {
        case "":
        case ".":
          // no-op
          break;
        case "..":
          if (normParts.length > 0) {
            normParts.pop();
          }
          break;
        default:
          normParts.push(part);
          break;
        }
      }
      return (root + normParts.join(separator)) || ".";
    }

    var ctors = {
      windows: function () { },
      posix: function () { }
    };

    ctors.windows.prototype.normalizePath = function (path) {
      var root = "";
      var parts = path.split(EITHER_SLASH);

      var part0 = parts[0];
      if (part0 === "") {
        if (parts[1] === "") {
          // UNC path
          root = parts.slice(0, 4).join("\\") + "\\";
          parts = parts.slice(4);
        } else {
          // root without drive letter
          root = "\\";
          parts.shift();
        }
      } else if (part0.length >= 2) {
        var ch1 = part0.charCodeAt(1);
        if (ch1 === 0x3A) { // ':'
          var ch0 = part0.charCodeAt(0);
          if (
            (0x41 <= ch0 && ch0 <= 0x5a) || // 'A'-'Z'
            (0x61 <= ch0 && ch0 <= 0x7a)    // 'a'-'z'
          ) {
            // there's a drive letter and colon
            if (part0.length === 2) {
              // ... with a slash following
              root = parts.shift() + "\\";
            } else {
              // ... without a slash following. path is relative
              // to drive's current dir
              root = part0.substr(0, 2);
              parts[0] = parts[0].slice(2);
            }
          }
        }
      }
      return genericNormalize(root.toUpperCase(), parts, "\\");
    };

    ctors.posix.prototype.normalizePath = function (path) {
      var root = "";
      var parts = path.split("/");
      if (parts[0] === "") {
        root = "/";
        parts.shift();
      }
      return genericNormalize(root, parts, "/");
    };

    var thisPlatform = new ctors[platform]();
    for (var k in ctors) {
      if (hasOwn.call(ctors, k)) {
        thisPlatform[k] = new ctors[k]();
      }
    }

    return thisPlatform;
  }
};


var SLASHES = /^\/+/;
var fileutil = {
  normalizeObject: function (object) {
    if (object instanceof Folder) {
      return new Folder(pathutil.normalizePath(object.fsName));
    }

    if (object instanceof File) {
      return new File(pathutil.normalizePath(object.fsName));
    }

    return pathutil.normalizePath(String(object));
  },

  isExistingFile: function (file) {
    return file instanceof File && file.exists;
  },

  join: function (folderObject, pathString) {
    var newUri = folderObject.absoluteURI;
    if (newUri.slice(-1) !== "/") {
      newUri += "/";
    }
    newUri += Folder.encode(pathString.replace(SLASHES, ""));
    return File(newUri);
  },

  readText: function (file) {
    if (file.open()) {
      var content = file.read();
      if (file.close()) {
        return content;
      }
    }
    return null;
  },

  readJson: function (file) {
    var content = fileutil.readText(file);
    return content && JSON.parse(content);
  }
};


function ParentSearchIterator(startFolder, childName) {
  if (typeof startFolder === "string") {
    startFolder = new Folder(startFolder);
  }
  this._folder = startFolder;
  this._childName = String(childName);
}
ParentSearchIterator.prototype.next = function () {
  while (this._folder && this._folder.name === this._childName) {
    this._folder = this._folder.parent;
  }

  var value, done;
  if (this._folder) {
    value = fileutil.join(this._folder, this._childName);
    this._folder = this._folder.parent;
    done = false;
  } else {
    done = true;
  }

  return {
    value: value,
    done: done
  };
};
function moduleSearchIterator(startFolder) {
  return new ParentSearchIterator(startFolder, "node_modules");
}


function resolvePolyfillPath(baseFolder, path) {
  // this differs from fully-implemented CommonJS loading because we can't
  // (securely) parse JSON, because we haven't loaded the polyfill for it at
  // the point this is called.

  for (
    var search = moduleSearchIterator(baseFolder), i = search.next();
    !i.done;
    i = search.next()
  ) {
    var tryFile = fileutil.join(i.value, path);
    if (fileutil.isExistingFile(tryFile)) {
      return tryFile;
    }
  }

  return null;
}


function loadPolyfills(baseFolder) {
  // module paths listed here must specify the path to the js file to be loaded,
  // relative to node_modules. as this is called before polyfills are loaded we
  // can't parse package.json to get the 'main' entry.
  var polyfills = [
    [ "es5-shim/es5-shim.js", topScope.Array.prototype.forEach ],
    [ "json3/lib/json3.js",   topScope.JSON ]
  ];

  var foundFiles = [ ];
  var missingPaths = [ ];

  var i;

  for (i = 0; i < polyfills.length; i++) {
    if (polyfills[i][1]) {
      continue;
    }

    var modulePath = polyfills[i][0];
    var moduleFile = resolvePolyfillPath(baseFolder, modulePath);

    if (moduleFile) {
      foundFiles.push(moduleFile);
    } else {
      missingPaths.push(modulePath);
    }
  }

  if (missingPaths.length > 0) {
    log(
      "require() was not able to locate the following " + missingPaths.length +
      " of " + polyfills.length + " dependencies:"
    );
    for (i = 0; i < missingPaths.length; i++) {
      log("* " + missingPaths[i]);
    }
    throw new Error("Failed to load commonjs dependencies");
  }

  for (i = 0; i < foundFiles.length; i++) {
    $.evalFile(foundFiles[i].fsName);
  }
}


var LEADING_DOTS_OR_SLASH = /^\.{0,2}\//;
var algo = {
  resolveModulePath: (function () {
    var memo = { };

    function memoGet(ka, kb) {
      var bucket = memo[ka];
      return bucket && bucket[kb];
    }

    function memoSet(ka, kb, value) {
      var bucket = hasOwn.call(memo, ka) ? memo[ka] : (memo[ka] = { });
      bucket[kb] = value;
    }

    function _resolveModulePath(basePath, moduleName) {
      moduleName = String(moduleName);

      var file = null;
      if (LEADING_DOTS_OR_SLASH.test(moduleName)) {
        var tryFile = fileutil.join(basePath, moduleName);
        file =
          algo.searchModuleFile(tryFile) ||
          algo.searchModuleDir(tryFile);
      }

      if (!file) {
        file =
          algo.searchNodeModules(basePath, moduleName) ||
          algo.searchGlobalPaths(moduleName);
      }

      if (!file) {
        throw new Error("Module not found: " + moduleName);
      }

      return fileutil.normalizeObject(file);
    }

    return function resolveModulePath(basePath, moduleName) {
      var basePathKey = basePath.fsName;
      var file = memoGet(basePathKey, moduleName);
      if (!file) {
        file = _resolveModulePath(basePath, moduleName);
        memoSet(basePathKey, moduleName, file);
      }
      return file;
    };
  }()),

  searchModuleFile: function (baseFile) {
    var tryFile = null;
    var trySuffixes = [ "", ".js", ".json" ];
    for (var i = 0; i < trySuffixes.length; i++) {
      tryFile = File(baseFile.absoluteURI + trySuffixes[i]);
      if (fileutil.isExistingFile(tryFile)) {
        return tryFile;
      }
    }
    return null;
  },

  searchModuleDir: function (baseDir) {
    var file, packageJson;
    var tryPackage = fileutil.join(baseDir, "package.json");

    try {
      packageJson = fileutil.readJson(tryPackage);
    } catch (error) { }

    if (packageJson && packageJson.main) {
      file = algo.searchModuleFile(fileutil.join(baseDir, packageJson.main));
      if (fileutil.isExistingFile(file)) {
        return file;
      }
    }

    var tryPaths = [ "index.js", "index.json" ];
    for (var i = 0; i < tryPaths.length; i++) {
      file = fileutil.join(baseDir, tryPaths[i]);
      if (fileutil.isExistingFile(file)) {
        return file;
      }
    }

    return null;
  },

  searchNodeModules: function (startFolder, moduleName) {
    var file = null;
    for (
      var search = moduleSearchIterator(startFolder), i = search.next();
      !i.done;
      i = search.next()
    ) {
      var tryFile = fileutil.join(i.value, moduleName);
      file = algo.searchModuleFile(tryFile) || algo.searchModuleDir(tryFile);
      if (fileutil.isExistingFile(file)) {
        return file;
      }
    }
    return null;
  },

  searchGlobalPaths: function (moduleName) {
    var file = null;
    for (var i = 0; i < moduleSearchPaths.length; i++) {
      var tryBase = Folder(moduleSearchPaths[i]);
      var tryFile = fileutil.join(tryBase, moduleName);
      file = algo.searchModuleFile(tryFile) || algo.searchModuleDir(tryFile);
      if (file) {
        return file;
      }
    }
    return null;
  }
};


var requireFrom;
var JSON_SUFFIX = /\.json$/i;
function loadModule(file) {
  var content = fileutil.readText(file);

  if (JSON_SUFFIX.test(file.name)) {
    return JSON.parse(content);
  }

  var moduleText =
    "/\x2A " + file.fsName + " \x2A/" +
    "(function(require, module, exports, __filename, __dirname) {" +
    content +
    "\n})";

  /*eslint no-eval: off */
  var evaluate = eval(moduleText);

  var moduleRequire = requireFrom.partialApply(file);
  moduleRequire.paths = moduleSearchPaths;

  var module = { exports: { } };

  evaluate(
    moduleRequire,
    module,
    module.exports,
    file.fsName,
    file.parent.fsName
  );

  return module.exports;
}

requireFrom = (function () {
  // TODO: cycles can be handled as specified if this cache is moved up one
  // scope and modules are addded as early as possible. make `loadModule`
  // handle this
  var loadedModules = { };

  return function (baseFile, moduleName) {
    moduleName = String(moduleName);
    var baseFolder = baseFile.parent;
    var file = algo.resolveModulePath(baseFolder, moduleName);
    var moduleKey = file.fsName;
    var moduleExports = loadedModules[moduleKey];
    if (!moduleExports) {
      moduleExports = loadedModules[moduleKey] = loadModule(file);
    }
    return moduleExports;
  };
}());

requireFrom.partialApply = function (baseFile) {
  return function (moduleName) {
    return requireFrom(baseFile, moduleName);
  };
};


function createBoundRequire(entryFile) {
  var require = requireFrom.partialApply(entryFile);
  require.setLogFunction = logging.setLogFunction;
  require.isInited = constFunction(true);
  require.init = function () {
    throw new Error("require() already inited");
  };

  return require;
}


var mainScriptPath;
function initRequire(newMainScriptPath) {
  mainScriptPath = String(newMainScriptPath);

  var thisScriptFile = fileutil.normalizeObject(new File($.fileName));
  loadPolyfills(thisScriptFile.parent);

  var mainScriptFile = fileutil.normalizeObject(new File(mainScriptPath));
  topScope.require = createBoundRequire(mainScriptFile);
}


function createUninitedRequire() {
  var require = function (_) {
    log(
      "require() not inited. It must be bootstrapped by calling " +
      "`require.init($.fileName)` from the main script."
    );
    throw new Error("require() not inited ");
  };

  require.setLogFunction = logging.setLogFunction;
  require.isInited = constFunction(false);
  require.init = initRequire;

  return require;
}


function init() {
  platformId = /windows/i.test($.os) ? "windows" : "posix";
  pathutil = pathutil.init(platformId);
  topScope.require = createUninitedRequire();
}


init();
}($.global));
