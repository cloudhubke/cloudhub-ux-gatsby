"use strict";

exports.__esModule = true;

var _nodes = require("./nodes");

exports.nodes = _nodes.nodesReducer;

var _logs = require("gatsby-cli/lib/reporter/redux/reducers/logs");

exports.logs = _logs.reducer;

var _pages = require("./pages");

exports.pages = _pages.pagesReducer;

var _redirects = require("./redirects");

exports.redirects = _redirects.redirectsReducer;

var _schema = require("./schema");

exports.schema = _schema.schemaReducer;

var _definitions = require("./definitions");

exports.definitions = _definitions.definitionsReducer;

var _staticQueryComponents = require("./static-query-components");

exports.staticQueryComponents = _staticQueryComponents.staticQueryComponentsReducer;

var _status = require("./status");

exports.status = _status.statusReducer;

var _webpack = require("./webpack");

exports.webpack = _webpack.webpackReducer;

var _webpackCompilationHash = require("./webpack-compilation-hash");

exports.webpackCompilationHash = _webpackCompilationHash.webpackCompilationHashReducer;

var _config = require("./config");

exports.config = _config.configReducer;

var _lastAction = require("./last-action");

exports.lastAction = _lastAction.lastActionReducer;

var _jobsv = require("./jobsv2");

exports.jobsV2 = _jobsv.jobsV2Reducer;

var _pageDataStats = require("./page-data-stats");

exports.pageDataStats = _pageDataStats.pageDataStatsReducer;

var _components = require("./components");

exports.components = _components.componentsReducer;

var _babelrc = require("./babelrc");

exports.babelrc = _babelrc.babelrcReducer;

var _jobs = require("./jobs");

exports.jobs = _jobs.jobsReducer;

var _nodesByType = require("./nodes-by-type");

exports.nodesByType = _nodesByType.nodesByTypeReducer;

var _program = require("./program");

exports.program = _program.programReducer;

var _resolvedNodes = require("./resolved-nodes");

exports.resolvedNodesCache = _resolvedNodes.resolvedNodesCacheReducer;

var _nodesTouched = require("./nodes-touched");

exports.nodesTouched = _nodesTouched.nodesTouchedReducer;

var _flattenedPlugins = require("./flattened-plugins");

exports.flattenedPlugins = _flattenedPlugins.flattenedPluginsReducer;

var _pendingPageDataWrites = require("./pending-page-data-writes");

exports.pendingPageDataWrites = _pendingPageDataWrites.pendingPageDataWritesReducer;

var _schemaCustomization = require("./schema-customization");

exports.schemaCustomization = _schemaCustomization.schemaCustomizationReducer;

var _inferenceMetadata = require("./inference-metadata");

exports.inferenceMetadata = _inferenceMetadata.inferenceMetadataReducer;

var _staticQueriesByTemplate = require("./static-queries-by-template");

exports.staticQueriesByTemplate = _staticQueriesByTemplate.staticQueriesByTemplateReducer;

var _queries = require("./queries");

exports.queries = _queries.queriesReducer;

var _visitedPage = require("./visited-page");

exports.visitedPages = _visitedPage.visitedPagesReducer;

var _html = require("./html");

exports.html = _html.htmlReducer;

var _functions = require("./functions");

exports.functions = _functions.functionsReducer;

var _nodeManifest = require("./node-manifest");

exports.nodeManifests = _nodeManifest.nodeManifestReducer;

var _pageTree = require("gatsby-cli/lib/reporter/redux/reducers/page-tree");

exports.pageTree = _pageTree.reducer;
//# sourceMappingURL=index.js.map