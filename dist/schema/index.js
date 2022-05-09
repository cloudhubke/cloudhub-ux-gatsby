"use strict";

const tracer = require(`opentracing`).globalTracer();

const {
  store
} = require(`../redux`);

const {
  getDataStore,
  getTypes
} = require(`../datastore`);

const {
  createSchemaComposer
} = require(`./schema-composer`);

const {
  buildSchema
} = require(`./schema`);

const {
  builtInFieldExtensions
} = require(`./extensions`);

const {
  builtInTypeDefinitions
} = require(`./types/built-in-types`);

const {
  TypeConflictReporter
} = require(`./infer/type-conflict-reporter`);

const {
  shouldPrintEngineSnapshot
} = require(`../utils/engines-helpers`);

const getAllTypeDefinitions = () => {
  const {
    schemaCustomization: {
      types
    }
  } = store.getState();
  const builtInTypes = builtInTypeDefinitions().map(typeDef => {
    return {
      typeOrTypeDef: typeDef,
      plugin: undefined
    };
  }); // Ensure that user-defined types are processed last

  return [...builtInTypes, ...types.filter(type => type.plugin && type.plugin.name !== `default-site-plugin`), ...types.filter(type => !type.plugin || type.plugin.name === `default-site-plugin`)];
};

const getAllFieldExtensions = () => {
  const {
    schemaCustomization: {
      fieldExtensions: customFieldExtensions
    }
  } = store.getState();
  return { ...customFieldExtensions,
    ...builtInFieldExtensions
  };
}; // Schema building requires metadata for type inference.
// Technically it means looping through all type nodes, analyzing node structure
// and then using this aggregated node structure in related GraphQL type.
// Actual logic for inference located in inferenceMetadata reducer and ./infer
// Here we just orchestrate the process via redux actions


const buildInferenceMetadata = ({
  types
}) => new Promise(resolve => {
  if (!types || !types.length) {
    resolve();
    return;
  }

  const typeNames = [...types]; // TODO: use async iterators when we switch to node>=10
  //  or better investigate if we can offload metadata building to worker/Jobs API
  //  and then feed the result into redux?

  const processNextType = () => {
    const typeName = typeNames.pop();
    store.dispatch({
      type: `BUILD_TYPE_METADATA`,
      payload: {
        typeName,
        nodes: getDataStore().iterateNodesByType(typeName)
      }
    });

    if (typeNames.length > 0) {
      // Give event-loop a break
      setTimeout(processNextType, 0);
    } else {
      resolve();
    }
  };

  processNextType();
});

const build = async ({
  parentSpan,
  fullMetadataBuild = true
}) => {
  const spanArgs = parentSpan ? {
    childOf: parentSpan
  } : {};
  const span = tracer.startSpan(`build schema`, spanArgs);
  await getDataStore().ready();

  if (fullMetadataBuild) {
    // Build metadata for type inference and start updating it incrementally
    await buildInferenceMetadata({
      types: getTypes()
    });
    store.dispatch({
      type: `START_INCREMENTAL_INFERENCE`
    });
  }

  const {
    schemaCustomization: {
      thirdPartySchemas,
      printConfig
    },
    inferenceMetadata,
    config: {
      mapping: typeMapping
    },
    program: {
      directory
    }
  } = store.getState();
  const typeConflictReporter = new TypeConflictReporter();
  const enginePrintConfig = "4" === `4` && shouldPrintEngineSnapshot() ? {
    path: `${directory}/.cache/schema.gql`,
    rewrite: true
  } : undefined;
  const fieldExtensions = getAllFieldExtensions();
  const schemaComposer = createSchemaComposer({
    fieldExtensions
  });
  const schema = await buildSchema({
    schemaComposer,
    types: getAllTypeDefinitions(),
    fieldExtensions,
    thirdPartySchemas,
    typeMapping,
    printConfig,
    enginePrintConfig,
    typeConflictReporter,
    inferenceMetadata,
    parentSpan
  });
  typeConflictReporter.printConflicts();
  store.dispatch({
    type: `SET_SCHEMA_COMPOSER`,
    payload: schemaComposer
  });
  store.dispatch({
    type: `SET_SCHEMA`,
    payload: schema
  });
  span.finish();
};

const rebuild = async ({
  parentSpan
}) => await build({
  parentSpan,
  fullMetadataBuild: false
});

module.exports = {
  build,
  rebuild
};
//# sourceMappingURL=index.js.map