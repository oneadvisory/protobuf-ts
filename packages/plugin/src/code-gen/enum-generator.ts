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
    let enumInfo = this.interpreter.getEnumInfo(descriptor);
    let enumObject = enumInfo[1];
    let prefix = enumInfo[2]; // optional shared prefix that was stripped
    let unionBuilder = new TypescriptUnionBuilder();

    const enumValues: Array<{
      name: string;
      comments?: string;
      number: number;
      originalName: string;
    }> = [];

    for (let ev of rt.listEnumValues(enumObject)) {
      // Restore the prefix to get the original protobuf name for lookup
      let originalName = prefix ? prefix + ev.name : ev.name;
      let evDescriptor = descriptor.values.find((v) => v.name === originalName);

      // Get user comments only (without @generated tags)
      let userComments: string | undefined;
      if (evDescriptor) {
        const enumValueComments = this.comments['getComments'](evDescriptor);
        userComments = enumValueComments.leading ?? '';
        if (enumValueComments.trailing) {
          if (userComments.length > 0) {
            userComments += '\n\n';
          }
          userComments += enumValueComments.trailing;
        }
        if (userComments.length === 0) {
          userComments = undefined;
        }
      }

      let number = evDescriptor ? evDescriptor.number : 0;

      // Still add the full comment block to unionBuilder for backward compat
      let fullComments = evDescriptor
        ? this.comments.getCommentBlock(evDescriptor, true)
        : '@generated synthetic value - protobuf-ts requires all enums to have a 0 value';
      unionBuilder.add(ev.name, fullComments);

      enumValues.push({
        name: ev.name,
        comments: userComments,
        number,
        originalName,
      });
    }

    const typeName = this.imports.type(source, descriptor);

    // Generate the type alias: export type MyEnum = "VALUE1" | "VALUE2";
    let typeStatement = unionBuilder.build(typeName, [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
    ]);

    // Build custom comment with enum definition
    const enumDefinition = this.buildEnumDefinition(descriptor, enumValues);
    const fullComment = this.buildTypeAliasComment(
      descriptor,
      enumDefinition
    );

    // Add leading detached comments
    const comments = this.comments['getComments'](descriptor);
    if (comments.leadingDetached && comments.leadingDetached.length > 0) {
      const { addCommentBlocksAsLeadingDetachedLines } = require('../framework/typescript-comments');
      addCommentBlocksAsLeadingDetachedLines(typeStatement, ...comments.leadingDetached);
    }

    // Add main JSDoc comment
    const { addCommentBlockAsJsDoc } = require('../framework/typescript-comments');
    addCommentBlockAsJsDoc(typeStatement, fullComment);

    // Add to our file
    source.addStatement(typeStatement);

    // Generate the const object for runtime: export const MyEnum = { VALUE1: "VALUE1", ... } as const;
    const constObject = this.generateEnumConstObject(typeName, enumValues);
    source.addStatement(constObject);

    // Generate the stringToNumber mapping constant: const MyEnum$stringToNumber = { VALUE1: 0, VALUE2: 1, ... } as const;
    const stringToNumberConst = this.generateStringToNumberConstant(
      typeName,
      enumValues
    );
    source.addStatement(stringToNumberConst);
    // Register the stringToNumber constant in the symbol table with 'stringToNumber' kind
    this.symbols.register(
      `${typeName}$stringToNumber`,
      descriptor,
      source,
      'stringToNumber'
    );

    // Generate the numberToString mapping constant: const MyEnum$numberToString = { 0: "VALUE1", 1: "VALUE2", ... } as const;
    const numberToStringConst = this.generateNumberToStringConstant(
      typeName,
      enumValues
    );
    source.addStatement(numberToStringConst);
    // Register the numberToString constant in the symbol table with 'numberToString' kind
    this.symbols.register(
      `${typeName}$numberToString`,
      descriptor,
      source,
      'numberToString'
    );

    return typeStatement;
  }

  /**
   * Builds the protobuf enum definition as a code block string.
   * Example output:
   * enum NestedEnum {
   *   ZERO = 0;
   *   FOO = 1;
   *   NEG = -1;  // Intentionally negative.
   * }
   */
  private buildEnumDefinition(
    descriptor: DescEnum,
    enumValues: Array<{
      name: string;
      comments?: string;
      number: number;
      originalName: string;
    }>
  ): string {
    const lines: string[] = [];
    lines.push(`enum ${descriptor.name} {`);

    for (const { originalName, number, comments } of enumValues) {
      let line = `  ${originalName} = ${number};`;

      // Add inline comment if user comment exists
      if (comments) {
        // Get just the first line of user comment for inline display
        const firstLine = comments.split('\n')[0].trim();
        line += `  // ${firstLine}`;
      }

      lines.push(line);
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Builds the full JSDoc comment for the type alias, including
   * the enum definition code block.
   */
  private buildTypeAliasComment(
    descriptor: DescEnum,
    enumDefinition: string
  ): string {
    // Get base comments (leading, trailing, deprecated, etc.)
    const comments = this.comments['getComments'](descriptor);
    let commentBlock = comments.leading ?? '';

    // Add trailing comments to the leading block
    if (comments.trailing) {
      if (commentBlock.length > 0) {
        commentBlock += '\n\n';
      }
      commentBlock += comments.trailing;
    }

    // Add space before @generated tag if there were comments
    if (commentBlock.length > 0) {
      commentBlock += '\n\n';
    }

    // Add deprecated tag if applicable
    if (descriptor.deprecated) {
      commentBlock += '@deprecated\n';
    }

    // Add @generated tag with enum definition
    commentBlock += `@generated from protobuf ${descriptor.toString()}:\n\n`;
    commentBlock += enumDefinition;

    return commentBlock;
  }

  private generateEnumConstObject(
    name: string | ts.Identifier,
    values: Array<{
      name: string;
      comments?: string;
      number: number;
      originalName: string;
    }>
  ): ts.VariableStatement {
    // Create properties: VALUE1: "VALUE1", VALUE2: "VALUE2", ...
    const properties: ts.PropertyAssignment[] = values.map(
      ({ name, comments, number, originalName }) => {
        const property = ts.factory.createPropertyAssignment(
          ts.factory.createIdentifier(name),
          ts.factory.createStringLiteral(name)
        );

        // Build the JSDoc comment
        let commentText: string;
        if (comments) {
          // User comment exists: format as compact JSDoc with user comment first
          const cleanComment = comments!.trim();
          const commentLines = cleanComment
            .split('\n')
            .map((line) => line.trim());
          const formattedUserComment = commentLines.join('\n * ');
          commentText = `* ${formattedUserComment}\n *\n * @generated from protobuf enum value: ${originalName} = ${number}; `;
        } else {
          // No user comment: just the @generated line in expanded format
          commentText = `*\n * @generated from protobuf enum value: ${originalName} = ${number};\n `;
        }

        ts.addSyntheticLeadingComment(
          property,
          ts.SyntaxKind.MultiLineCommentTrivia,
          commentText,
          false
        );

        return property;
      }
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

  /**
   * Generate the stringToNumber mapping constant for binary serialization.
   * Example output:
   * const MyEnum$stringToNumber = { VALUE1: 0, VALUE2: 1, ... } as const;
   */
  private generateStringToNumberConstant(
    name: string | ts.Identifier,
    values: Array<{
      name: string;
      comments?: string;
      number: number;
      originalName: string;
    }>
  ): ts.VariableStatement {
    // Create properties: VALUE1: 0, VALUE2: 1, ...
    const properties: ts.PropertyAssignment[] = values.map(({ name, number }) => {
      // Handle negative numbers with prefix unary expression
      const numberExpression =
        number < 0
          ? ts.factory.createPrefixUnaryExpression(
              ts.SyntaxKind.MinusToken,
              ts.factory.createNumericLiteral(`${-number}`)
            )
          : ts.factory.createNumericLiteral(`${number}`);

      return ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier(name),
        numberExpression
      );
    });

    // Create the object literal
    const objectLiteral = ts.factory.createObjectLiteralExpression(
      properties,
      true // multiLine
    );

    // Add 'as const' assertion
    const asConstExpression = ts.factory.createAsExpression(
      objectLiteral,
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier('const'),
        undefined
      )
    );

    // Create variable name: MyEnum$stringToNumber
    const variableName =
      typeof name === 'string'
        ? `${name}$stringToNumber`
        : ts.factory.createIdentifier(
            `${name.text}$stringToNumber`
          );

    // Create: const MyEnum$stringToNumber = { ... } as const;
    const variableDeclaration = ts.factory.createVariableDeclaration(
      variableName,
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

  /**
   * Generate the numberToString mapping constant for binary deserialization.
   * Example output:
   * const MyEnum$numberToString = { 0: "VALUE1", 1: "VALUE2", ... } as const;
   *
   * Note: For alias enums (multiple strings with same number), only the first
   * string is included in the map.
   */
  private generateNumberToStringConstant(
    name: string | ts.Identifier,
    values: Array<{
      name: string;
      comments?: string;
      number: number;
      originalName: string;
    }>
  ): ts.VariableStatement {
    // Create properties: 0: "VALUE1", 1: "VALUE2", ...
    // For alias enums, only include the first string for each unique number
    const numberMap = new Map<number, string>();
    for (const { name, number } of values) {
      if (!numberMap.has(number)) {
        numberMap.set(number, name);
      }
    }

    const properties: ts.PropertyAssignment[] = Array.from(numberMap.entries()).map(
      ([number, name]) => {
        // Handle negative numbers with prefix unary expression for the key
        const keyExpression =
          number < 0
            ? ts.factory.createComputedPropertyName(
                ts.factory.createPrefixUnaryExpression(
                  ts.SyntaxKind.MinusToken,
                  ts.factory.createNumericLiteral(`${-number}`)
                )
              )
            : ts.factory.createIdentifier(`${number}`);

        return ts.factory.createPropertyAssignment(
          keyExpression,
          ts.factory.createStringLiteral(name)
        );
      }
    );

    // Create the object literal
    const objectLiteral = ts.factory.createObjectLiteralExpression(
      properties,
      true // multiLine
    );

    // Add 'as const' assertion
    const asConstExpression = ts.factory.createAsExpression(
      objectLiteral,
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier('const'),
        undefined
      )
    );

    // Create variable name: MyEnum$numberToString
    const variableName =
      typeof name === 'string'
        ? `${name}$numberToString`
        : ts.factory.createIdentifier(
            `${name.text}$numberToString`
          );

    // Create: const MyEnum$numberToString = { ... } as const;
    const variableDeclaration = ts.factory.createVariableDeclaration(
      variableName,
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
