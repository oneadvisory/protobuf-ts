import type { JsonObject, JsonValue } from './json-typings';
import { base64encode } from './base64';
import type { JsonWriteOptions } from './json-format-contract';
import { PbLong, PbULong } from './pb-long';
import type {
  EnumInfo,
  FieldInfo,
  PartialMessageInfo,
} from './reflection-info';
import { ScalarType } from './reflection-info';
import type { IMessageType } from './message-type-contract';
import { assert, assertFloat32, assertInt32, assertUInt32 } from './assert';
import type { UnknownMessage, UnknownOneofGroup } from './unknown-types';

/**
 * Writes proto3 messages in canonical JSON format using reflection
 * information.
 *
 * https://developers.google.com/protocol-buffers/docs/proto3#json
 */
export class ReflectionJsonWriter {
  private readonly fields: readonly FieldInfo[];

  constructor(info: PartialMessageInfo) {
    this.fields = info.fields ?? [];
  }

  /**
   * Converts the message to a JSON object, based on the field descriptors.
   */
  write<T extends object>(message: T, options: JsonWriteOptions): JsonValue {
    const json: JsonObject = {},
      source = message as UnknownMessage;
    for (const field of this.fields) {
      // field is not part of a oneof, simply write as is
      if (!field.oneof) {
        let jsonValue = this.field(field, source[field.localName], options);
        if (jsonValue !== undefined)
          json[options.useProtoFieldName ? field.name : field.jsonName] =
            jsonValue;
        continue;
      }
      // field is part of a oneof
      const group = source as UnknownOneofGroup;
      const value = group[field.localName];
      const opt: JsonWriteOptions =
        field.kind == 'scalar' || field.kind == 'enum'
          ? { ...options, emitDefaultValues: true } // make sure to emit default values too
          : options;
      let jsonValue = this.field(
        {
          ...(field as any),
          opt: true,
        },
        value,
        opt
      );
      json[options.useProtoFieldName ? field.name : field.jsonName] =
        jsonValue!;
    }
    return json;
  }

  field(
    field: FieldInfo,
    value: unknown,
    options: JsonWriteOptions
  ): JsonValue | undefined {
    let jsonValue: JsonValue | undefined = undefined;
    if (field.kind == 'map') {
      assert(typeof value == 'object' && value !== null);

      const jsonObj: JsonObject = {};

      switch (field.V.kind) {
        case 'scalar':
          for (const [entryKey, entryValue] of Object.entries(value)) {
            const val = this.scalar(
              field.V.T,
              entryValue,
              field.name,
              false,
              true
            );
            assert(val !== undefined);
            jsonObj[entryKey.toString()] = val; // JSON standard allows only (double quoted) string as property key
          }
          break;

        case 'message':
          const messageType = field.V.T();
          for (const [entryKey, entryValue] of Object.entries(value)) {
            const val = this.message(
              messageType,
              entryValue,
              field.name,
              options
            );
            assert(val !== undefined);
            jsonObj[entryKey.toString()] = val; // JSON standard allows only (double quoted) string as property key
          }
          break;

        case 'enum':
          const enumInfo = field.V.T();
          for (const [entryKey, entryValue] of Object.entries(value)) {
            assert(entryValue === undefined || typeof entryValue == 'number');
            const val = this.enum(
              enumInfo,
              entryValue,
              field.name,
              false,
              true,
              options.enumAsInteger
            );
            assert(val !== undefined);
            jsonObj[entryKey.toString()] = val; // JSON standard allows only (double quoted) string as property key
          }
          break;
      }

      if (options.emitDefaultValues || Object.keys(jsonObj).length > 0)
        jsonValue = jsonObj;
    } else if (field.repeat) {
      assert(Array.isArray(value));

      const jsonArr: JsonValue[] = [];

      switch (field.kind) {
        case 'scalar':
          for (let i = 0; i < value.length; i++) {
            const val = this.scalar(
              field.T,
              value[i],
              field.name,
              field.opt,
              true
            );
            assert(val !== undefined);
            jsonArr.push(val);
          }
          break;

        case 'enum':
          const enumInfo = field.T();
          for (let i = 0; i < value.length; i++) {
            assert(value[i] === undefined || typeof value[i] == 'number');
            const val = this.enum(
              enumInfo,
              value[i],
              field.name,
              field.opt,
              true,
              options.enumAsInteger
            );
            assert(val !== undefined);
            jsonArr.push(val);
          }
          break;

        case 'message':
          const messageType = field.T();
          for (let i = 0; i < value.length; i++) {
            const val = this.message(
              messageType,
              value[i],
              field.name,
              options
            );
            assert(val !== undefined);
            jsonArr.push(val);
          }
          break;
      }

      // add converted array to json output
      if (
        options.emitDefaultValues ||
        jsonArr.length > 0 ||
        options.emitDefaultValues
      )
        jsonValue = jsonArr;
    } else {
      switch (field.kind) {
        case 'scalar':
          try {
            jsonValue = this.scalar(
              field.T,
              value,
              field.name,
              field.opt,
              options.emitDefaultValues
            );
          } catch (e) {
            console.error(e, field);
            throw e;
          }
          break;

        case 'enum':
          jsonValue = this.enum(
            field.T(),
            value,
            field.name,
            field.opt,
            options.emitDefaultValues,
            options.enumAsInteger
          );
          break;

        case 'message':
          jsonValue = this.message(field.T(), value, field.name, options);
          break;
      }
    }

    return jsonValue;
  }

  /**
   * Returns `null` as the default for google.protobuf.NullValue.
   */
  enum(
    type: EnumInfo,
    value: unknown,
    fieldName: string,
    optional: boolean,
    emitDefaultValues: boolean,
    enumAsInteger: boolean
  ): JsonValue | undefined {
    if (type[0] == 'google.protobuf.NullValue')
      return !emitDefaultValues && !optional ? undefined : null;
    if (value === undefined) {
      assert(optional);
      return undefined;
    }

    // Handle both string and number values for backwards compatibility
    if (typeof value === 'number') {
      // For numeric enums (from old system or external libraries like @bufbuild/protobuf)
      if (value === 0 && !emitDefaultValues && !optional)
        return undefined;
      if (enumAsInteger)
        return value;
      // Try to find the name for this number in the enum values
      const enumValues = Object.keys(type[1]);
      // For old-style numeric enums, we would have the reverse mapping
      // For new string enums, just return the first value
      return enumValues[0] || "";
    }

    // Handle string values (new system)
    assert(typeof value == 'string', `Expected string or number enum value but got ${typeof value}`);
    // Get the first enum value as the default
    const firstValue = Object.keys(type[1])[0] || "";
    if (value === firstValue && !emitDefaultValues && !optional)
      // don't emit default value
      return undefined;
    // Verify the value exists in the enum
    if (!type[1].hasOwnProperty(value)) {
      // Unknown enum value, return as-is
      return value;
    }
    if (type[2])
      // restore the dropped prefix
      return type[2] + value;
    return value;
  }

  message(
    type: IMessageType<any>,
    value: unknown,
    fieldName: string,
    options: JsonWriteOptions
  ): JsonValue | undefined {
    if (value === undefined)
      return options.emitDefaultValues ? null : undefined;
    return type.internalJsonWrite(value, options);
  }

  scalar(
    type: ScalarType,
    value: unknown,
    fieldName: string,
    optional: false,
    emitDefaultValues: boolean
  ): JsonValue;
  scalar(
    type: ScalarType,
    value: unknown,
    fieldName: string,
    optional: boolean,
    emitDefaultValues: boolean
  ): JsonValue | undefined;
  scalar(
    type: ScalarType,
    value: unknown,
    fieldName: string,
    optional: boolean,
    emitDefaultValues: boolean
  ): JsonValue | undefined {
    if (value === undefined) {
      assert(optional, `Field ${fieldName} is not optional but got undefined`);
      return undefined;
    }

    const ed = emitDefaultValues || optional;

    // noinspection FallThroughInSwitchStatementJS
    switch (type) {
      // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
      case ScalarType.INT32:
      case ScalarType.SFIXED32:
      case ScalarType.SINT32:
        if (value === 0) return ed ? 0 : undefined;
        assertInt32(value);
        return value;

      case ScalarType.FIXED32:
      case ScalarType.UINT32:
        if (value === 0) return ed ? 0 : undefined;
        assertUInt32(value);
        return value;

      // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
      // Either numbers or strings are accepted. Exponent notation is also accepted.
      case ScalarType.FLOAT:
        assertFloat32(value);
      case ScalarType.DOUBLE:
        if (value === 0) return ed ? 0 : undefined;
        assert(typeof value == 'number');
        if (Number.isNaN(value)) return 'NaN';
        if (value === Number.POSITIVE_INFINITY) return 'Infinity';
        if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
        return value;

      // string:
      case ScalarType.STRING:
        if (value === '') return ed ? '' : undefined;
        assert(typeof value == 'string');
        return value;

      // bool:
      case ScalarType.BOOL:
        if (value === false) return ed ? false : undefined;
        assert(typeof value == 'boolean');
        return value;

      // JSON value will be a decimal string. Either numbers or strings are accepted.
      case ScalarType.UINT64:
      case ScalarType.FIXED64:
        assert(
          typeof value == 'number' ||
            typeof value == 'string' ||
            typeof value == 'bigint'
        );
        let ulong = PbULong.from(value);
        if (ulong.isZero() && !ed) return undefined;
        return ulong.toString();

      // JSON value will be a decimal string. Either numbers or strings are accepted.
      case ScalarType.INT64:
      case ScalarType.SFIXED64:
      case ScalarType.SINT64:
        assert(
          typeof value == 'number' ||
            typeof value == 'string' ||
            typeof value == 'bigint'
        );
        let long = PbLong.from(value);
        if (long.isZero() && !ed) return undefined;
        return long.toString();

      // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
      // Either standard or URL-safe base64 encoding with/without paddings are accepted.
      case ScalarType.BYTES:
        assert(value instanceof Uint8Array);
        if (!value.byteLength) return ed ? '' : undefined;
        return base64encode(value);
    }
  }
}
