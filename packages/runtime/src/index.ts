// Public API of the protobuf-ts runtime (types-only version).
// This runtime provides only type definitions and utilities needed for
// TypeScript interface generation. No serialization/deserialization code.

// Convenience JSON typings and corresponding type guards
export {type JsonValue, type JsonObject, typeofJsonValue, isJsonObject} from './json-typings';

// Binary format type definitions (no implementation)
export {
    WireType,
    type BinaryReadOptions,
    type BinaryWriteOptions,
    type IBinaryWriter,
    type IBinaryReader,
    type UnknownFieldHandler,
} from './binary-format-contract';

// JSON format type definitions (no implementation)
export {
    type JsonReadOptions, type JsonWriteOptions, type JsonWriteStringOptions
} from './json-format-contract';

// Message type contract - type definitions only
export {type IMessageType, type PartialMessage, MESSAGE_TYPE} from './message-type-contract';

// Minimal MessageType and BinaryWriter stubs for plugin use during code generation
export {MessageType} from './message-type';
export {BinaryWriter} from './binary-writer';

// Reflection info - types used by generated code and plugin
export {
    ScalarType,
    LongType,
    RepeatType,
    type MessageInfo,
    type EnumInfo,
    type FieldInfo,
    type PartialFieldInfo,
    normalizeFieldInfo,
    readFieldOptions,
    readFieldOption,
    readMessageOption
} from './reflection-info';

// Types for message objects at runtime, when concrete type is unknown.
export {
    type UnknownEnum,
    type UnknownMap,
    type UnknownMessage,
    type UnknownOneofGroup,
    type UnknownScalar
} from './unknown-types';

// Enum object type guard and reflection util
export {type EnumObjectValue, listEnumValues, listEnumNames, listEnumNumbers, isEnumObject} from './enum-object';

// Enum conversion helpers
export {getFirstEnumValue, enumNumberToString, enumStringToNumber} from './enum-helpers';

// lowerCamelCase() is exported for plugin
export {lowerCamelCase} from './lower-camel-case';

// assertion functions are exported for plugin
export {assert, assertNever, assertInt32, assertUInt32, assertFloat32} from './assert';
