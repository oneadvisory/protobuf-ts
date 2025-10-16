import {isEnumObject, listEnumNames, listEnumNumbers, listEnumValues} from "../src";

// Mock string-based enum objects (matching new protobuf-ts format)
const ValidEnum = {
  ANY: "ANY",
  YES: "YES",
  YEAH: "YEAH"
} as const;

// Invalid enum: mixed types
const MixedEnum = {
  ANY: "ANY",
  YES: 123  // Invalid: not a string
} as const;

// Invalid enum: values don't match keys
const MismatchedEnum = {
  ANY: "WRONG",
  YES: "ALSO_WRONG"
} as const;


describe('isEnumObject()', function () {

    it('accepts valid string-based enum', () => {
        expect(isEnumObject(ValidEnum)).toBeTrue();
    });

    it('rejects mixed type enum', () => {
        expect(isEnumObject(MixedEnum)).toBeFalse();
    });

    it('rejects mismatched enum', () => {
        expect(isEnumObject(MismatchedEnum)).toBeFalse();
    });

    it('rejects empty object', () => {
        expect(isEnumObject({})).toBeFalse();
    });

});


describe('listEnumValues()', function () {

    it('works with string-based enum', () => {
        let expected: any = [
            {name: "ANY"},
            {name: "YES"},
            {name: "YEAH"},
        ];
        expect(listEnumValues(ValidEnum)).toEqual(expected);
    });

    it('throws for mixed type enum', () => {
        expect(() => listEnumValues(MixedEnum)).toThrowError();
    });

    it('throws for mismatched enum', () => {
        expect(() => listEnumValues(MismatchedEnum)).toThrowError();
    });

});



describe('listEnumNumbers()', function () {

    it('returns empty array for string-based enums (deprecated)', () => {
        let expected: any = [];
        expect(listEnumNumbers(ValidEnum)).toEqual(expected);
    });

    it('throws for invalid enum', () => {
        expect(() => listEnumNumbers(MixedEnum)).toThrowError();
    });

});



describe('listEnumNames()', function () {

    it('works with string-based enum', () => {
        let expected: any = ["ANY", "YES", "YEAH"];
        expect(listEnumNames(ValidEnum)).toEqual(expected);
    });

    it('throws for invalid enum', () => {
        expect(() => listEnumNames(MixedEnum)).toThrowError();
    });

});


