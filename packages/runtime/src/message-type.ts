import type {FieldInfo, MessageInfo, PartialFieldInfo} from "./reflection-info";
import {normalizeFieldInfo} from "./reflection-info";
import type {JsonValue} from "./json-typings";
import type {IMessageType, PartialMessage} from "./message-type-contract";
import type {BinaryReadOptions, BinaryWriteOptions, IBinaryReader, IBinaryWriter} from "./binary-format-contract";
import type {JsonReadOptions, JsonWriteOptions, JsonWriteStringOptions} from "./json-format-contract";

/**
 * Minimal MessageType stub for use by plugin during code generation.
 * This is NOT used at runtime - only for reading proto options during compilation.
 */
export class MessageType<T extends object> implements IMessageType<T> {
    readonly typeName: string;
    readonly fields: readonly FieldInfo[];
    readonly options: { [extensionName: string]: JsonValue };

    constructor(
        typeName: string,
        fields: readonly PartialFieldInfo[],
        options?: { [extensionName: string]: JsonValue }
    ) {
        this.typeName = typeName;
        this.fields = fields.map(normalizeFieldInfo);
        this.options = options ?? {};
    }

    // Stub implementations - not actually functional, just to satisfy interface
    create(_value?: PartialMessage<T>): T {
        throw new Error("MessageType.create() is not implemented - this is a stub for plugin use only");
    }

    fromBinary(_data: Uint8Array, _options?: Partial<BinaryReadOptions>): T {
        throw new Error("MessageType.fromBinary() is not implemented - this is a stub for plugin use only");
    }

    toBinary(_message: T, _options?: Partial<BinaryWriteOptions>): Uint8Array {
        throw new Error("MessageType.toBinary() is not implemented - this is a stub for plugin use only");
    }

    fromJson(_json: JsonValue, _options?: Partial<JsonReadOptions>): T {
        throw new Error("MessageType.fromJson() is not implemented - this is a stub for plugin use only");
    }

    fromJsonString(_json: string, _options?: Partial<JsonReadOptions>): T {
        throw new Error("MessageType.fromJsonString() is not implemented - this is a stub for plugin use only");
    }

    toJson(_message: T, _options?: Partial<JsonWriteOptions>): JsonValue {
        throw new Error("MessageType.toJson() is not implemented - this is a stub for plugin use only");
    }

    toJsonString(_message: T, _options?: Partial<JsonWriteStringOptions>): string {
        throw new Error("MessageType.toJsonString() is not implemented - this is a stub for plugin use only");
    }

    clone(_message: T): T {
        throw new Error("MessageType.clone() is not implemented - this is a stub for plugin use only");
    }

    mergePartial(_target: T, _source: PartialMessage<T>): void {
        throw new Error("MessageType.mergePartial() is not implemented - this is a stub for plugin use only");
    }

    equals(_a: T | undefined, _b: T | undefined): boolean {
        throw new Error("MessageType.equals() is not implemented - this is a stub for plugin use only");
    }

    is(_arg: any, _depth?: number): _arg is T {
        throw new Error("MessageType.is() is not implemented - this is a stub for plugin use only");
    }

    isAssignable(_arg: any, _depth?: number): _arg is T {
        throw new Error("MessageType.isAssignable() is not implemented - this is a stub for plugin use only");
    }

    internalJsonRead(_json: JsonValue, _options: JsonReadOptions, _target?: T): T {
        throw new Error("MessageType.internalJsonRead() is not implemented - this is a stub for plugin use only");
    }

    internalJsonWrite(_message: T, _options: JsonWriteOptions): JsonValue {
        throw new Error("MessageType.internalJsonWrite() is not implemented - this is a stub for plugin use only");
    }

    internalBinaryWrite(_message: T, _writer: IBinaryWriter, _options: BinaryWriteOptions): IBinaryWriter {
        throw new Error("MessageType.internalBinaryWrite() is not implemented - this is a stub for plugin use only");
    }

    internalBinaryRead(_reader: IBinaryReader, _length: number, _options: BinaryReadOptions, _target?: T): T {
        throw new Error("MessageType.internalBinaryRead() is not implemented - this is a stub for plugin use only");
    }
}
