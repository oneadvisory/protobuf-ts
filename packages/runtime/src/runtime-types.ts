import type { Tagged } from 'type-fest';

// Well-known types with special JSON encoding
export type TimestampString = Tagged<string, 'Timestamp'>;
export type DurationString = Tagged<string, 'Duration'>;
export type Base64String = Tagged<string, 'Base64'>;

/**
 * Field mask string is a string that represents a field mask.
 * It is a comma-separated list of field paths.
 * For example, "name,age" or "name,address.street".
 * It is used to represent a field mask in a JSON object.
 * It is not a valid JSON string, but it is a valid string that can be used to represent a field mask.
 * It is used to represent a field mask in a JSON object.
 */
export type FieldMaskString = Tagged<string, 'FieldMask'>;

// Wrapper types with string JSON representation (64-bit integers)
export type Int64ValueString = Tagged<string, 'Int64Value'>;
export type UInt64ValueString = Tagged<string, 'UInt64Value'>;

export type AnyJson = {
  '@type': string;
  [key: string]: unknown;
};
