"use strict";

exports.__esModule = true;
exports.getPagination = exports.getGroup = exports.getEdge = exports.getPageInfo = void 0;

var _sort = require("./sort");

var _derivedTypes = require("./derived-types");

var _resolvers = require("../resolvers");

const getPageInfo = ({
  schemaComposer
}) => schemaComposer.getOrCreateOTC(`PageInfo`, tc => {
  tc.addFields({
    currentPage: `Int!`,
    hasPreviousPage: `Boolean!`,
    hasNextPage: `Boolean!`,
    itemCount: `Int!`,
    pageCount: `Int!`,
    perPage: `Int`,
    totalCount: `Int!`
  });
});

exports.getPageInfo = getPageInfo;

const getEdge = ({
  schemaComposer,
  typeComposer
}) => {
  const typeName = `${typeComposer.getTypeName()}Edge`;
  (0, _derivedTypes.addDerivedType)({
    typeComposer,
    derivedTypeName: typeName
  });
  return schemaComposer.getOrCreateOTC(typeName, tc => {
    tc.addFields({
      next: typeComposer,
      node: typeComposer.getTypeNonNull(),
      previous: typeComposer
    });
  });
};

exports.getEdge = getEdge;

const getGroup = ({
  schemaComposer,
  typeComposer
}) => {
  const typeName = `${typeComposer.getTypeName()}GroupConnection`;
  const fields = {
    field: `String!`,
    fieldValue: `String`
  };
  return createPagination({
    schemaComposer,
    typeComposer,
    typeName,
    fields
  });
};

exports.getGroup = getGroup;

const getPagination = ({
  schemaComposer,
  typeComposer
}) => {
  const typeName = `${typeComposer.getTypeName()}Connection`;
  return createPagination({
    schemaComposer,
    typeComposer,
    typeName
  });
};

exports.getPagination = getPagination;

function createPagination({
  schemaComposer,
  typeComposer,
  fields,
  typeName
}) {
  const inputTypeComposer = typeComposer.getInputTypeComposer();
  const fieldsEnumTC = (0, _sort.getFieldsEnum)({
    schemaComposer,
    typeComposer,
    inputTypeComposer
  });
  const paginationTypeComposer = schemaComposer.getOrCreateOTC(typeName, tc => {
    // getGroup() will create a recursive call to pagination,
    // so only add it and other aggregate functions on onCreate.
    // Cast into their own category to avoid Typescript conflicts.
    const aggregationFields = {
      distinct: {
        type: [`String!`],
        args: {
          field: fieldsEnumTC.getTypeNonNull()
        },
        resolve: _resolvers.distinct
      },
      max: {
        type: `Float`,
        args: {
          field: fieldsEnumTC.getTypeNonNull()
        },
        resolve: _resolvers.max
      },
      min: {
        type: `Float`,
        args: {
          field: fieldsEnumTC.getTypeNonNull()
        },
        resolve: _resolvers.min
      },
      sum: {
        type: `Float`,
        args: {
          field: fieldsEnumTC.getTypeNonNull()
        },
        resolve: _resolvers.sum
      },
      group: {
        type: [getGroup({
          schemaComposer,
          typeComposer
        }).getTypeNonNull()],
        args: {
          skip: `Int`,
          limit: `Int`,
          field: fieldsEnumTC.getTypeNonNull()
        },
        resolve: _resolvers.group
      }
    };
    tc.addFields({
      totalCount: `Int!`,
      edges: [getEdge({
        schemaComposer,
        typeComposer
      }).getTypeNonNull()],
      nodes: [typeComposer.getTypeNonNull()],
      pageInfo: getPageInfo({
        schemaComposer
      }).getTypeNonNull(),
      ...aggregationFields,
      ...fields
    });
  });
  paginationTypeComposer.makeFieldNonNull(`edges`);
  paginationTypeComposer.makeFieldNonNull(`nodes`);
  paginationTypeComposer.makeFieldNonNull(`distinct`);
  paginationTypeComposer.makeFieldNonNull(`group`);
  (0, _derivedTypes.addDerivedType)({
    typeComposer,
    derivedTypeName: typeName
  });
  return paginationTypeComposer;
}
//# sourceMappingURL=pagination.js.map