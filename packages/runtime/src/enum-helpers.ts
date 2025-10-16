import type {EnumInfo} from "./reflection-info";

/**
 * Gets the first string value from an enum object.
 * This is used as the default value for enum fields.
 *
 * @param enumInfo The enum information tuple [typeName, enumObject, prefix?]
 * @returns The first enum string value
 */
export function getFirstEnumValue(enumInfo: EnumInfo): string {
    const enumObject = enumInfo[1];
    const firstKey = Object.keys(enumObject)[0];
    if (!firstKey) {
        throw new Error(`Enum ${enumInfo[0]} has no values`);
    }
    return enumObject[firstKey];
}

/**
 * Converts a protobuf wire format number to the corresponding enum string value.
 *
 * @param numberToString Map from wire numbers to enum string values (e.g., {1: "YES", 2: "NO"})
 * @param num The wire format number
 * @returns The enum string value, or the first value if not found
 */
export function enumNumberToString(
    numberToString: Record<number, string>,
    num: number
): string {
    // Direct O(1) lookup
    const str = numberToString[num];
    if (str !== undefined) {
        return str;
    }
    // If not found, return first value as fallback
    const firstValue = Object.values(numberToString)[0];
    return firstValue ?? "";
}

/**
 * Converts an enum string value to its protobuf wire format number.
 *
 * @param stringToNumber Map from enum string values to their wire numbers (e.g., {"YES": 1, "NO": 2})
 * @param str The enum string value
 * @returns The wire format number, or 0 if not found
 */
export function enumStringToNumber(
    stringToNumber: Record<string, number>,
    str: string
): number {
    const num = stringToNumber[str];
    return num !== undefined ? num : 0;
}

/**
 * Converts a stringToNumber map to a numberToString map.
 * For alias enums (multiple strings with same number), only the first
 * string is included in the result.
 *
 * @param stringToNumber Map from enum string values to their wire numbers (e.g., {"YES": 1, "NO": 2})
 * @returns Map from wire numbers to enum string values (e.g., {1: "YES", 2: "NO"})
 */
export function stringToNumberToNumberToString(
    stringToNumber: Record<string, number>
): Record<number, string> {
    const numberToString: Record<number, string> = {};
    for (const [str, num] of Object.entries(stringToNumber)) {
        // Only keep the first string for each number (handles alias enums)
        if (!(num in numberToString)) {
            numberToString[num] = str;
        }
    }
    return numberToString;
}
