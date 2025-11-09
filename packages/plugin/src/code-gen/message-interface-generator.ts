import * as ts from 'typescript';
import * as rt from '@oneadvisory/protobuf-ts-runtime';
import { assert } from '@oneadvisory/protobuf-ts-runtime';
import { TypescriptFile } from '../framework/typescript-file';
import { CommentGenerator } from './comment-generator';
import { createLocalTypeName } from './local-type-name';
import { Interpreter } from '../interpreter';
import { DescField, DescMessage, DescOneof } from '@bufbuild/protobuf';
import { TypeScriptImports } from '../framework/typescript-imports';
import { SymbolTable } from '../framework/symbol-table';

export class MessageInterfaceGenerator {
  constructor(
    private readonly symbols: SymbolTable,
    private readonly imports: TypeScriptImports,
    private readonly comments: CommentGenerator,
    private readonly interpreter: Interpreter,
    private readonly options: {
      normalLongType: rt.LongType;
      runtimeImportPath: string;
    }
  ) {}

  registerSymbols(source: TypescriptFile, descMessage: DescMessage): void {
    this.symbols.register(
      createLocalTypeName(descMessage),
      descMessage,
      source
    );
  }

  /**
   * `message` as an interface.
   *
   * For the following .proto:
   *
   *   message MyMessage {
   *     string str_field = 1;
   *   }
   *
   * We generate the following interface:
   *
   *   interface MyMessage {
   *     strField: string;
   *   }
   *
   */
  generateMessageInterface(
    source: TypescriptFile,
    descMessage: DescMessage
  ): ts.InterfaceDeclaration {
    const interpreterType = this.interpreter.getMessageType(
        descMessage.typeName
      ),
      processedOneofs: string[] = [], // oneof groups already processed
      members: ts.TypeElement[] = []; // the interface members

    for (let fieldInfo of interpreterType.fields) {
      const descField = descMessage.fields.find(
        (descField) => descField.number === fieldInfo.no
      );
      assert(descField);
      if (fieldInfo.oneof && descField.oneof) {
        if (processedOneofs.includes(fieldInfo.oneof)) {
          continue;
        }

        // Create a single property for each oneof case
        members.push(
          ...this.createOneofADTPropertySignatureList(source, descField.oneof)
        );
        processedOneofs.push(fieldInfo.oneof);
      } else {
        // create regular properties
        members.push(
          this.createFieldPropertySignature(source, descField, fieldInfo)
        );
      }
    }

    // export interface MyMessage { ...
    const statement = ts.factory.createInterfaceDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      this.imports.type(source, descMessage),
      undefined,
      undefined,
      members
    );

    // add to our file
    source.addStatement(statement);
    this.comments.addCommentsForDescriptor(
      statement,
      descMessage,
      'appendToLeadingBlock'
    );
    return statement;
  }

  /**
   * Create property signature for a protobuf field. Example:
   *
   *    fieldName: number
   *
   */
  private createFieldPropertySignature(
    source: TypescriptFile,
    descField: DescField,
    fieldInfo: rt.FieldInfo,
    isOneOf?: boolean
  ): ts.PropertySignature {
    let type: ts.TypeNode; // the property type, may be made optional or wrapped into array at the end
    let isBrandedStringType = false; // Track if we're dealing with a branded string type (Timestamp, Duration, wrapper values)

    switch (fieldInfo.kind) {
      case 'scalar':
        type = this.createScalarTypeNode(source, fieldInfo.T, fieldInfo.L);
        break;

      case 'enum':
        type = this.createEnumTypeNode(source, fieldInfo.T());
        break;

      case 'message':
        const messageType = fieldInfo.T();
        // Use branded string types for well-known types with special JSON encoding
        if (messageType.typeName === 'google.protobuf.Timestamp') {
          type = ts.factory.createTypeReferenceNode(
            this.imports.name(
              source,
              'TimestampString',
              this.options.runtimeImportPath,
              true
            ),
            undefined
          );
          isBrandedStringType = true;
        } else if (messageType.typeName === 'google.protobuf.Duration') {
          type = ts.factory.createTypeReferenceNode(
            this.imports.name(
              source,
              'DurationString',
              this.options.runtimeImportPath,
              true
            ),
            undefined
          );
          isBrandedStringType = true;
        } else if (messageType.typeName === 'google.protobuf.Int64Value') {
          type = ts.factory.createTypeReferenceNode(
            this.imports.name(
              source,
              'Int64ValueString',
              this.options.runtimeImportPath,
              true
            ),
            undefined
          );
          isBrandedStringType = true;
        } else if (messageType.typeName === 'google.protobuf.UInt64Value') {
          type = ts.factory.createTypeReferenceNode(
            this.imports.name(
              source,
              'UInt64ValueString',
              this.options.runtimeImportPath,
              true
            ),
            undefined
          );
          isBrandedStringType = true;
        } else if (messageType.typeName === 'google.protobuf.BytesValue') {
          type = ts.factory.createTypeReferenceNode(
            this.imports.name(
              source,
              'Base64String',
              this.options.runtimeImportPath,
              true
            ),
            undefined
          );
          isBrandedStringType = true;
        } else if (
          messageType.typeName === 'google.protobuf.DoubleValue' ||
          messageType.typeName === 'google.protobuf.FloatValue' ||
          messageType.typeName === 'google.protobuf.Int32Value' ||
          messageType.typeName === 'google.protobuf.UInt32Value'
        ) {
          // Wrapper types with JSON number representation
          type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
          isBrandedStringType = true;
        } else if (messageType.typeName === 'google.protobuf.BoolValue') {
          // Wrapper type with JSON boolean representation
          type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
          isBrandedStringType = true;
        } else if (messageType.typeName === 'google.protobuf.StringValue') {
          // Wrapper type with JSON string representation
          type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
          isBrandedStringType = true;
        } else if (messageType.typeName === 'google.protobuf.FieldMask') {
          // FieldMask with JSON string representation (comma-separated paths)
          type = ts.factory.createTypeReferenceNode(
            this.imports.name(
              source,
              'FieldMaskString',
              this.options.runtimeImportPath,
              true
            ),
            undefined
          );
        } else if (messageType.typeName === 'google.protobuf.Value') {
          // Value can be any JSON value
          type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
        } else if (messageType.typeName === 'google.protobuf.NullValue') {
          // NullValue is always null in JSON
          type = ts.factory.createLiteralTypeNode(ts.factory.createNull());
        } else if (messageType.typeName === 'google.protobuf.ListValue') {
          // ListValue is an array of any JSON values
          type = ts.factory.createArrayTypeNode(
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
          );
          isBrandedStringType = true;
        } else if (messageType.typeName === 'google.protobuf.Any') {
          // Any with JSON representation as { $type: string, [key: string]: unknown }
          type = ts.factory.createTypeReferenceNode(
            this.imports.name(
              source,
              'AnyJson',
              this.options.runtimeImportPath,
              true
            ),
            undefined
          );
          isBrandedStringType = true;
        } else {
          type = this.createMessageTypeNode(source, messageType);
        }
        break;

      case 'map':
        let keyType =
          fieldInfo.K === rt.ScalarType.BOOL
            ? ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
            : this.createScalarTypeNode(
                source,
                fieldInfo.K,
                rt.LongType.STRING
              );
        let valueType;
        switch (fieldInfo.V.kind) {
          case 'scalar':
            valueType = this.createScalarTypeNode(
              source,
              fieldInfo.V.T,
              fieldInfo.V.L
            );
            break;
          case 'enum':
            valueType = this.createEnumTypeNode(source, fieldInfo.V.T());
            break;
          case 'message':
            const mapValueType = fieldInfo.V.T();
            // Use branded string types for well-known types with special JSON encoding in map values
            if (mapValueType.typeName === 'google.protobuf.Timestamp') {
              valueType = ts.factory.createTypeReferenceNode(
                this.imports.name(
                  source,
                  'TimestampString',
                  this.options.runtimeImportPath,
                  true
                ),
                undefined
              );
            } else if (mapValueType.typeName === 'google.protobuf.Duration') {
              valueType = ts.factory.createTypeReferenceNode(
                this.imports.name(
                  source,
                  'DurationString',
                  this.options.runtimeImportPath,
                  true
                ),
                undefined
              );
            } else if (mapValueType.typeName === 'google.protobuf.Int64Value') {
              valueType = ts.factory.createTypeReferenceNode(
                this.imports.name(
                  source,
                  'Int64ValueString',
                  this.options.runtimeImportPath,
                  true
                ),
                undefined
              );
            } else if (
              mapValueType.typeName === 'google.protobuf.UInt64Value'
            ) {
              valueType = ts.factory.createTypeReferenceNode(
                this.imports.name(
                  source,
                  'UInt64ValueString',
                  this.options.runtimeImportPath,
                  true
                ),
                undefined
              );
            } else if (mapValueType.typeName === 'google.protobuf.BytesValue') {
              valueType = ts.factory.createTypeReferenceNode(
                this.imports.name(
                  source,
                  'Base64String',
                  this.options.runtimeImportPath,
                  true
                ),
                undefined
              );
            } else if (
              mapValueType.typeName === 'google.protobuf.DoubleValue' ||
              mapValueType.typeName === 'google.protobuf.FloatValue' ||
              mapValueType.typeName === 'google.protobuf.Int32Value' ||
              mapValueType.typeName === 'google.protobuf.UInt32Value'
            ) {
              // Wrapper types with JSON number representation
              valueType = ts.factory.createKeywordTypeNode(
                ts.SyntaxKind.NumberKeyword
              );
            } else if (mapValueType.typeName === 'google.protobuf.BoolValue') {
              // Wrapper type with JSON boolean representation
              valueType = ts.factory.createKeywordTypeNode(
                ts.SyntaxKind.BooleanKeyword
              );
            } else if (
              mapValueType.typeName === 'google.protobuf.StringValue'
            ) {
              // Wrapper type with JSON string representation
              valueType = ts.factory.createKeywordTypeNode(
                ts.SyntaxKind.StringKeyword
              );
            } else if (mapValueType.typeName === 'google.protobuf.FieldMask') {
              // FieldMask with JSON string representation (comma-separated paths)
              valueType = ts.factory.createTypeReferenceNode(
                this.imports.name(
                  source,
                  'FieldMaskString',
                  this.options.runtimeImportPath,
                  true
                ),
                undefined
              );
            } else if (mapValueType.typeName === 'google.protobuf.Value') {
              // Value can be any JSON value
              valueType = ts.factory.createKeywordTypeNode(
                ts.SyntaxKind.UnknownKeyword
              );
            } else if (mapValueType.typeName === 'google.protobuf.NullValue') {
              // NullValue is always null in JSON
              valueType = ts.factory.createLiteralTypeNode(
                ts.factory.createNull()
              );
            } else if (mapValueType.typeName === 'google.protobuf.ListValue') {
              // ListValue is an array of any JSON values
              valueType = ts.factory.createArrayTypeNode(
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
              );
            } else if (mapValueType.typeName === 'google.protobuf.Any') {
              // Any with JSON representation as { $type: string, [key: string]: unknown }
              valueType = ts.factory.createTypeReferenceNode(
                this.imports.name(
                  source,
                  'AnyJson',
                  this.options.runtimeImportPath,
                  true
                ),
                undefined
              );
            } else {
              valueType = this.createMessageTypeNode(source, mapValueType);
            }
            break;
        }
        type = ts.factory.createTypeLiteralNode([
          ts.factory.createIndexSignature(
            undefined,
            [
              ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                ts.factory.createIdentifier('key'),
                undefined,
                keyType,
                undefined
              ),
            ],
            valueType
          ),
        ]);
        break;
      default:
        throw new Error('unkown kind ' + descField.toString());
    }

    // if repeated, wrap type into array type
    if (fieldInfo.repeat) {
      type = ts.factory.createArrayTypeNode(type);
    }

    // if optional, add question mark
    let questionToken;
    if (isBrandedStringType) {
      // For branded string types (Timestamp, Duration, wrapper values), only add ? if explicitly marked as optional
      questionToken =
        descField.proto.proto3Optional || fieldInfo.repeat || isOneOf
          ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
          : undefined;
    } else {
      // Normal logic for other fields
      questionToken =
        fieldInfo.opt || fieldInfo.repeat || isOneOf
          ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
          : undefined;
    }

    // create property
    const property = ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier(fieldInfo.localName),
      questionToken,
      type
    );
    this.comments.addCommentsForDescriptor(
      property,
      descField,
      'trailingLines'
    );
    return property;
  }

  private createOneofADTPropertySignatureList(
    source: TypescriptFile,
    descOneof: DescOneof
  ): ts.PropertySignature[] {
    const oneofCases: ts.PropertySignature[] = [],
      [parentMessageDesc, interpreterType, oneofLocalName] =
        this.oneofInfo(descOneof),
      memberFieldInfos = interpreterType.fields.filter(
        (fi) => fi.oneof === oneofLocalName
      );

    // create a type for each selection case
    for (let fieldInfo of memberFieldInfos) {
      // { ..., fieldName: type } part
      let descField = parentMessageDesc.fields.find(
        (fd) => fd.number === fieldInfo.no
      );
      assert(descField !== undefined);
      let valueProperty = this.createFieldPropertySignature(
        source,
        descField,
        fieldInfo,
        true
      );

      // add this case
      oneofCases.push(valueProperty);
    }

    return oneofCases;
  }

  /**
   * Helper to find for a OneofDescriptorProto:
   * [0] the message descriptor
   * [1] a corresponding message type generated by the interpreter
   * [2] the runtime local name of the oneof
   */
  private oneofInfo(
    descOneof: DescOneof
  ): [DescMessage, rt.IMessageType<rt.UnknownMessage>, string] {
    const parent: DescMessage = descOneof.parent;
    const interpreterType = this.interpreter.getMessageType(parent);
    const sampleField = descOneof.fields[0];
    const sampleFieldInfo = interpreterType.fields.find(
      (fi) => fi.no === sampleField.number
    );
    assert(sampleFieldInfo !== undefined);
    const oneofName = sampleFieldInfo.oneof;
    assert(oneofName !== undefined);
    return [parent, interpreterType, oneofName];
  }

  private createScalarTypeNode(
    source: TypescriptFile,
    scalarType: rt.ScalarType,
    longType?: rt.LongType
  ): ts.TypeNode {
    switch (scalarType) {
      case rt.ScalarType.BOOL:
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
      case rt.ScalarType.STRING:
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
      case rt.ScalarType.BYTES:
        // Use Base64String branded type for bytes
        return ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier('Base64String'),
          undefined
        );
      case rt.ScalarType.DOUBLE:
      case rt.ScalarType.FLOAT:
      case rt.ScalarType.INT32:
      case rt.ScalarType.FIXED32:
      case rt.ScalarType.UINT32:
      case rt.ScalarType.SFIXED32:
      case rt.ScalarType.SINT32:
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
      case rt.ScalarType.SFIXED64:
      case rt.ScalarType.INT64:
      case rt.ScalarType.FIXED64:
      case rt.ScalarType.SINT64:
      case rt.ScalarType.UINT64:
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    }
  }

  private createMessageTypeNode(
    source: TypescriptFile,
    type: rt.IMessageType<rt.UnknownMessage>
  ): ts.TypeNode {
    return ts.factory.createTypeReferenceNode(
      this.imports.typeByName(source, type.typeName),
      undefined
    );
  }

  private createEnumTypeNode(
    source: TypescriptFile,
    ei: rt.EnumInfo
  ): ts.TypeNode {
    let [enumTypeName] = ei;
    return ts.factory.createTypeReferenceNode(
      this.imports.typeByName(source, enumTypeName),
      undefined
    );
  }
}
