import * as ts from 'typescript';
import * as rt from '@oneadvisory/protobuf-ts-runtime';
import { TypescriptFile } from '../framework/typescript-file';
import { CommentGenerator } from './comment-generator';
import { DescEnum } from '@bufbuild/protobuf';
import { Interpreter } from '../interpreter';
import { createLocalTypeName } from './local-type-name';
import { TypeScriptImports } from '../framework/typescript-imports';
import { SymbolTable } from '../framework/symbol-table';
import { TypescriptUnionBuilder } from '../framework/typescript-union-builder';

export class EnumGenerator {
  constructor(
    private readonly symbols: SymbolTable,
    private readonly imports: TypeScriptImports,
    private readonly comments: CommentGenerator,
    private readonly interpreter: Interpreter
  ) {}

  registerSymbols(source: TypescriptFile, descEnum: DescEnum): void {
    this.symbols.register(createLocalTypeName(descEnum), descEnum, source);
  }

  /**
   * For the following .proto:
   *
   * ```proto
   *   enum MyEnum {
   *     ANY = 0;
   *     YES = 1;
   *     NO = 2;
   *   }
   * ```
   *
   * We generate the following type and const object:
   *
   * ```typescript
   *   export type MyEnum = "ANY" | "YES" | "NO";
   *
   *   export const MyEnum = {
   *     ANY: "ANY",
   *     YES: "YES",
   *     NO: "NO"
   *   } as const;
   * ```
   *
   * We drop a shared prefix, for example:
   *
   * ```proto
   * enum MyEnum {
   *     MY_ENUM_FOO = 0;
   *     MY_ENUM_BAR = 1;
   * }
   * ```
   *
   * Becomes:
   *
   * ```typescript
   *   export type MyEnum = "FOO" | "BAR";
   *
   *   export const MyEnum = {
   *     FOO: "FOO",
   *     BAR: "BAR"
   *   } as const;
   * ```
   *
   */
  generateEnum(
    source: TypescriptFile,
    descriptor: DescEnum
  ): ts.TypeAliasDeclaration {
    let enumObject = this.interpreter.getEnumInfo(descriptor)[1],
      unionBuilder = new TypescriptUnionBuilder();

    const enumValues: Array<{ name: string; comments?: string }> = [];

    for (let ev of rt.listEnumValues(enumObject)) {
      let evDescriptor = descriptor.values.find((v) => v.number === ev.number);
      let comments = evDescriptor
        ? this.comments.getCommentBlock(evDescriptor, true)
        : '@generated synthetic value - protobuf-ts requires all enums to have a 0 value';
      unionBuilder.add(ev.name, comments);
      enumValues.push({ name: ev.name, comments });
    }

    const typeName = this.imports.type(source, descriptor);

    // Generate the type alias: export type MyEnum = "VALUE1" | "VALUE2";
    let typeStatement = unionBuilder.build(typeName, [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
    ]);

    // Add to our file
    source.addStatement(typeStatement);
    this.comments.addCommentsForDescriptor(
      typeStatement,
      descriptor,
      'appendToLeadingBlock'
    );

    // Generate the const object for runtime: export const MyEnum = { VALUE1: "VALUE1", ... } as const;
    const constObject = this.generateEnumConstObject(typeName, enumValues);
    source.addStatement(constObject);

    return typeStatement;
  }

  private generateEnumConstObject(
    name: string | ts.Identifier,
    values: Array<{ name: string; comments?: string }>
  ): ts.VariableStatement {
    // Create properties: VALUE1: "VALUE1", VALUE2: "VALUE2", ...
    const properties: ts.PropertyAssignment[] = values.map(({ name }) =>
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier(name),
        ts.factory.createStringLiteral(name)
      )
    );

    // Create the object literal
    const objectLiteral = ts.factory.createObjectLiteralExpression(
      properties,
      true  // multiLine
    );

    // Add 'as const' assertion
    const asConstExpression = ts.factory.createAsExpression(
      objectLiteral,
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier('const'),
        undefined
      )
    );

    // Create: const MyEnum = { ... } as const;
    const variableDeclaration = ts.factory.createVariableDeclaration(
      name,
      undefined,
      undefined,
      asConstExpression
    );

    // Wrap in variable statement with export
    return ts.factory.createVariableStatement(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList(
        [variableDeclaration],
        ts.NodeFlags.Const
      )
    );
  }
}
