import * as ts from 'typescript';

/**
 * Creates a string literal union type declaration for enums.
 */
export class TypescriptUnionBuilder {
  private readonly values: Array<{
    name: string;
    comment?: string;
  }> = [];

  add(name: string, comment?: string) {
    this.values.push({ name, comment });
  }

  build(
    name: string | ts.Identifier,
    modifiers?: readonly ts.Modifier[]
  ): ts.TypeAliasDeclaration {
    this.validate();

    // Create string literal type nodes for each enum value
    const literalTypes: ts.TypeNode[] = this.values.map(({ name }) =>
      ts.factory.createLiteralTypeNode(
        ts.factory.createStringLiteral(name)
      )
    );

    // Create a union of all the literal types
    const unionType = ts.factory.createUnionTypeNode(literalTypes);

    // Create the type alias declaration
    const typeAlias = ts.factory.createTypeAliasDeclaration(
      modifiers,
      name,
      undefined,
      unionType
    );

    // Comments will be added by the enum generator
    return typeAlias;
  }

  private validate() {
    if (this.values.length === 0) {
      throw new Error('Cannot create empty union type');
    }

    // Check for duplicate names
    const names = this.values.map((v) => v.name);
    if (names.some((name, i, a) => a.indexOf(name) !== i)) {
      throw new Error('duplicate names');
    }
  }
}
