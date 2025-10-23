// Minimal type definitions for JSON format (no implementation)
// These types are only used in interface definitions and are not used at runtime

export interface JsonReadOptions {
    ignoreUnknownFields?: boolean;
    typeRegistry?: any[];
}

export interface JsonWriteOptions {
    emitDefaultValues?: boolean;
    enumAsInteger?: boolean;
    useProtoFieldName?: boolean;
    typeRegistry?: any[];
}

export interface JsonWriteStringOptions extends JsonWriteOptions {
    prettySpaces?: number;
}
