function assertStrictEqual(got, expect) {
  if (got !== expect) {
    throw new Error("Expected " + got + " to be strictly equal to " + expect);
  }
}

var _tests = [ ];
function test(name, func) {
  _tests.push([ name, func ]);
}

function go() {
  var separator = new Array(30).join("-");
  $.writeln(separator);

  var total = _tests.length;
  var pass = 0;
  var fail = 0;

  for (var i = 0; i < total; i++) {
    var theTest = _tests[i];
    var name = theTest[0];
    var func = theTest[1];

    try {
      func();
      pass++;
    } catch (error) {
      fail++;
      $.writeln("FAIL: (" + i + ") " + name);
      $.writeln("  " + String(error));
    }
  }

  if (total === 0) {
    $.writeln("No tests defined");
  } else {
    $.writeln(fail === 0 ? "\u2705   pass" : "\u274C   FAIL");

    if (fail !== 0) {
      $.writeln("failed: " + fail);
    }
    $.writeln("passed: " + pass);
  }

  $.writeln(separator);
}


test("Simple case", function () {
  var testModule = require("./test-module");
  assertStrictEqual(testModule.aNumber, 489);
  assertStrictEqual(
    testModule.aFunction("an argument"),
    "you passed me an argument"
  );
});


test("Statefulness 1", function () {
  var testStatefulModule = require("./test-stateful-module");
  assertStrictEqual(testStatefulModule(), 1);
  assertStrictEqual(testStatefulModule(), 2);
  assertStrictEqual(testStatefulModule(), 3);
});

test("Statefulness 2", function () {
  var testStatefulModule = require("./test-stateful-module");
  assertStrictEqual(testStatefulModule(), 4);
});

test("Directory as module", function () {
  var dirModule = require("./dir-module");
  assertStrictEqual(dirModule.testDir(), "directory");
});

test("JSON as module", function () {
  var json = require("./test-json");
  assertStrictEqual(json.json, "json");
  assertStrictEqual(json.anObject.anArray[2], 2);
});

test("Module with package.json", function () {
  var packageModule = require("./package-module");
  assertStrictEqual(packageModule(), "The package export worked");
});

go();
