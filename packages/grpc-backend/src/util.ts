import * as grpc from "@grpc/grpc-js";
import {RpcMetadata} from "@oneadvisory/protobuf-ts-runtime-rpc";


/**
 * Is the given argument a ServiceError as provided
 * by @grpc/grpc-js?
 *
 * A ServiceError is a specialized Error object, extended
 * with the properties "code", "details" and "metadata".
 */
export function isServiceError(arg: any): arg is grpc.ServiceError {
    if (typeof arg != 'object' || !arg) {
        return false;
    }
    return typeof arg.code == 'number'
        && typeof arg.details == 'string'
        && typeof arg.metadata == 'object'
        && typeof arg.name == 'string'
        && typeof arg.message == 'string';
}


/**
 * Parse a gRPC status code from a string.
 */
export function rpcCodeToGrpc(from: string): grpc.status | undefined {
    const value = (grpc.status as any)[from];
    return typeof value === 'number' ? value : undefined;
}

/**
 * Convert our RPC Metadata to gRPC Metadata.
 */
export function metadataToGrpc(from: RpcMetadata, base?: grpc.Metadata): grpc.Metadata {
    const to = base ?? new grpc.Metadata();
    const decode = (k: string, v: string) => k.endsWith('-bin') ? Buffer.from(v, 'base64') : v;
    for (let k of Object.keys(from)) {
        let v = from[k];
        if (typeof v == 'string') {
            to.add(k, decode(k, v));
        } else if (Array.isArray(v)) {
            for (let vv of v) {
                to.add(k, decode(k, vv));
            }
        }
    }
    return to;
}


/**
 * Convert gRPC Metadata to our RPC Metadata.
 */
export function metadataFromGrpc(from: grpc.Metadata): RpcMetadata {
    const to: RpcMetadata = {};
    const h2 = from.toHttp2Headers();
    for (let k of Object.keys(h2)) {
        let v = h2[k];
        if (v === undefined) {
            continue;
        }
        if (typeof v === "number") {
            to[k] = v.toString();
        } else if (typeof v === "string") {
            to[k] = v;
        } else if (Array.isArray(v)) {
            if (v.length === 1) {
                to[k] = v[0];
            } else if (v.length > 1) {
                to[k] = v;
            }
        }
    }
    return to;
}
