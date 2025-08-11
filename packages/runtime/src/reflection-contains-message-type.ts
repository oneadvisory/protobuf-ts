import {type IMessageType, MESSAGE_TYPE} from './message-type-contract';

/**
 * The interface that models storing type in a symbol property.
 *
 * Note that this is an experimental feature - it is here to stay, but
 * implementation details may change without notice.
 */
export interface MessageTypeContainer<T extends object> {
    [MESSAGE_TYPE]: IMessageType<T>;
}

/**
 * Check if the provided object is a proto message.
 *
 * Note that this is an experimental feature - it is here to stay, but
 * implementation details may change without notice.
 */
export function containsMessageType<T extends object>(msg: T): msg is (T & MessageTypeContainer<T>) {
    return (msg as MessageTypeContainer<T>)[MESSAGE_TYPE] != null;
}
