"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.resolveModuleExports = void 0;

var fs = _interopRequireWildcard(require("fs-extra"));

var t = _interopRequireWildcard(require("@babel/types"));

var _traverse = _interopRequireDefault(require("@babel/traverse"));

var _codeFrame = require("@babel/code-frame");

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _babelParseToAst = require("../utils/babel-parse-to-ast");

var _testRequireError = require("../utils/test-require-error");

var _moduleResolver = require("../utils/module-resolver");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const staticallyAnalyzeExports = (modulePath, resolver = _moduleResolver.resolveModule) => {
  let absPath;
  const exportNames = [];

  try {
    absPath = resolver(modulePath);
  } catch (err) {
    return exportNames; // doesn't exist
  }

  const code = fs.readFileSync(absPath, `utf8`); // get file contents

  let ast;

  try {
    ast = (0, _babelParseToAst.babelParseToAst)(code, absPath);
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Pretty print syntax errors
      const codeFrame = (0, _codeFrame.codeFrameColumns)(code, {
        start: err.loc
      }, {
        highlightCode: true
      });

      _reporter.default.panic(`Syntax error in "${absPath}":\n${err.message}\n${codeFrame}`);
    } else {
      // if it's not syntax error, just throw it
      throw err;
    }
  }

  let isCommonJS = false;
  let isES6 = false; // extract names of exports from file

  (0, _traverse.default)(ast, {
    // Check if the file is using ES6 imports
    ImportDeclaration: function ImportDeclaration() {
      isES6 = true;
    },
    ExportNamedDeclaration: function ExportNamedDeclaration(astPath) {
      var _declaration$declarat, _declaration$id;

      const declaration = astPath.node.declaration; // get foo from `export const foo = bar`

      if ((declaration === null || declaration === void 0 ? void 0 : declaration.type) === `VariableDeclaration` && ((_declaration$declarat = declaration.declarations[0]) === null || _declaration$declarat === void 0 ? void 0 : _declaration$declarat.id.type) === `Identifier`) {
        isES6 = true;
        exportNames.push(declaration.declarations[0].id.name);
      } // get foo from `export function foo()`


      if ((declaration === null || declaration === void 0 ? void 0 : declaration.type) === `FunctionDeclaration` && ((_declaration$id = declaration.id) === null || _declaration$id === void 0 ? void 0 : _declaration$id.type) === `Identifier`) {
        isES6 = true;
        exportNames.push(declaration.id.name);
      }
    },
    // get foo from `export { foo } from 'bar'`
    // get foo from `export { foo }`
    ExportSpecifier: function ExportSpecifier(astPath) {
      var _astPath$node;

      isES6 = true;
      const exp = astPath === null || astPath === void 0 ? void 0 : (_astPath$node = astPath.node) === null || _astPath$node === void 0 ? void 0 : _astPath$node.exported;

      if (!exp) {
        return;
      }

      if (exp.type === `Identifier`) {
        const exportName = exp.name;

        if (exportName) {
          exportNames.push(exportName);
        }
      }
    },
    // export default () => {}
    // export default function() {}
    // export default function foo() {}
    // const foo = () => {}; export default foo
    ExportDefaultDeclaration: function ExportDefaultDeclaration(astPath) {
      const declaration = astPath.node.declaration;

      if (!t.isIdentifier(declaration) && !t.isArrowFunctionExpression(declaration) && !t.isFunctionDeclaration(declaration)) {
        return;
      }

      let name = ``;

      if (t.isIdentifier(declaration)) {
        name = declaration.name;
      } else if (t.isFunctionDeclaration(declaration) && declaration.id) {
        name = declaration.id.name;
      }

      const exportName = `export default${name ? ` ${name}` : ``}`;
      isES6 = true;
      exportNames.push(exportName);
    },
    AssignmentExpression: function AssignmentExpression(astPath) {
      const nodeLeft = astPath.node.left;

      if (!t.isMemberExpression(nodeLeft)) {
        return;
      } // ignore marker property `__esModule`


      if (t.isIdentifier(nodeLeft.property) && nodeLeft.property.name === `__esModule`) {
        return;
      } // get foo from `exports.foo = bar`


      if (t.isIdentifier(nodeLeft.object) && nodeLeft.object.name === `exports`) {
        isCommonJS = true;
        exportNames.push(nodeLeft.property.name);
      } // get foo from `module.exports.foo = bar`


      if (t.isMemberExpression(nodeLeft.object)) {
        const exp = nodeLeft.object;

        if (t.isIdentifier(exp.object) && t.isIdentifier(exp.property) && exp.object.name === `module` && exp.property.name === `exports`) {
          isCommonJS = true;
          exportNames.push(nodeLeft.property.name);
        }
      }
    }
  });

  if (isES6 && isCommonJS && process.env.NODE_ENV !== `test`) {
    _reporter.default.panic(`This plugin file is using both CommonJS and ES6 module systems together which we don't support.
You'll need to edit the file to use just one or the other.

plugin: ${modulePath}.js

This didn't cause a problem in Gatsby v1 so you might want to review the migration doc for this:
https://gatsby.dev/no-mixed-modules
      `);
  }

  return exportNames;
};
/**
 * Given a `require.resolve()` compatible path pointing to a JS module,
 * return an array listing the names of the module's exports.
 *
 * Returns [] for invalid paths and modules without exports.
 *
 * @param modulePath
 * @param mode
 * @param resolver
 */


const resolveModuleExports = (modulePath, {
  mode = `analysis`,
  resolver = _moduleResolver.resolveModule
} = {}) => {
  if (mode === `require`) {
    let absPath;

    try {
      absPath = require.resolve(modulePath);
      return Object.keys(require(modulePath)).filter(exportName => exportName !== `__esModule`);
    } catch (e) {
      if (!(0, _testRequireError.testRequireError)(modulePath, e)) {
        // if module exists, but requiring it cause errors,
        // show the error to the user and terminate build
        _reporter.default.panic(`Error in "${absPath}":`, e);
      }
    }
  } else {
    return staticallyAnalyzeExports(modulePath, resolver);
  }

  return [];
};

exports.resolveModuleExports = resolveModuleExports;
//# sourceMappingURL=resolve-module-exports.js.map