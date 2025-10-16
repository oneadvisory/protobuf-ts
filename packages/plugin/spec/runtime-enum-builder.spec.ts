import { isEnumObject } from '@oneadvisory/protobuf-ts-runtime';
import { RuntimeEnumBuilder } from '../src/interpreter';

describe('RuntimeEnumBuilder', function () {
  let builder: RuntimeEnumBuilder;

  beforeEach(function () {
    builder = new RuntimeEnumBuilder();
  });

  it('should throw error on empty build()', () => {
    expect(() => builder.build()).toThrowError();
    expect(builder.isValid()).toBeFalse();
  });

  it('should build() valid', () => {
    builder.add('UNSPECIFIED', 0);
    builder.add('YES', 1);
    builder.add('NO', 2);
    let result = builder.build();
    expect(isEnumObject(result.enumObject)).toBeTrue();
    expect(builder.isValid()).toBeTrue();
    // String-based enum format: keys map to themselves
    expect(result.enumObject['UNSPECIFIED']).toBe('UNSPECIFIED');
    expect(result.enumObject['YES']).toBe('YES');
    expect(result.enumObject['NO']).toBe('NO');
    // Check number mapping
    expect(result.stringToNumber['UNSPECIFIED']).toBe(0);
    expect(result.stringToNumber['YES']).toBe(1);
    expect(result.stringToNumber['NO']).toBe(2);
  });

  it('should throw on duplicate name', () => {
    builder.add('FOO', 0);
    builder.add('FOO', 1);
    expect(() => builder.build()).toThrowError();
    expect(builder.isValid()).toBeFalse();
  });

  it('should build() valid (duplicate test)', () => {
    builder.add('UNSPECIFIED', 0);
    builder.add('YES', 1);
    builder.add('NO', 2);
    let result = builder.build();
    expect(isEnumObject(result.enumObject)).toBeTrue();
    expect(builder.isValid()).toBeTrue();
    // String-based enum format: keys map to themselves
    expect(result.enumObject['UNSPECIFIED']).toBe('UNSPECIFIED');
    expect(result.enumObject['YES']).toBe('YES');
    expect(result.enumObject['NO']).toBe('NO');
  });
});
