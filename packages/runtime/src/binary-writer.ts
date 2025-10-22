import type {IBinaryWriter} from "./binary-format-contract";

/**
 * Minimal BinaryWriter stub for use by plugin during code generation.
 * This is NOT used at runtime - only by interpreter when reading proto options.
 */
export class BinaryWriter implements IBinaryWriter {
    private buffer: number[][] = [];

    constructor() {
        // Minimal stub
    }

    tag(fieldNo: number, wireType: number): BinaryWriter {
        this.buffer.push([fieldNo, wireType]);
        return this;
    }

    raw(data: Uint8Array): BinaryWriter {
        // Stub method - just for compatibility
        return this;
    }

    finish(): Uint8Array {
        return new Uint8Array(0); // Empty stub
    }
}
