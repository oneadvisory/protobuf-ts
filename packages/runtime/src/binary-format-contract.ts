// Minimal type definitions for binary format (no implementation)
// These types are only used in interface definitions and are not used at runtime

export interface BinaryReadOptions {
    readUnknownField?: boolean;
    readerFactory?: (bytes: Uint8Array) => IBinaryReader;
}

export interface BinaryWriteOptions {
    writeUnknownFields?: boolean;
    writerFactory?: () => IBinaryWriter;
}

export interface IBinaryReader {
    // Minimal interface - not implemented
}

export interface IBinaryWriter {
    // Minimal interface - not implemented
}

export enum WireType {
    Varint = 0,
    Bit64 = 1,
    LengthDelimited = 2,
    StartGroup = 3,
    EndGroup = 4,
    Bit32 = 5,
}

export type UnknownFieldHandler = {
    // Minimal type - not implemented
};
