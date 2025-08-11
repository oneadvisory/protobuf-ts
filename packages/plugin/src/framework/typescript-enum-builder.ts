import * as ts from 'typescript';
import * as rt from '@oneadvisory/protobuf-ts-runtime';
import { addCommentBlockAsJsDoc } from './typescript-comments';

/**
 * Creates an enum declaration.
 */
export class TypescriptEnumBuilder {
  private readonly values: Array<{
    name: string;
    number: number;
    comment?: string;
  }> = [];

  add(name: string, number: number, comment?: string) {
    this.values.push({ name, number, comment });
  }

  build(
    name: string | ts.Identifier,
    modifiers?: readonly ts.Modifier[]
  ): ts.EnumDeclaration {
    this.validate();
    const members: ts.EnumMember[] = [];
    for (let { name, number, comment } of this.values) {
      let member = ts.factory.createEnumMember(
        ts.factory.createIdentifier(name),
        number < 0
          ? ts.factory.createPrefixUnaryExpression(
              ts.SyntaxKind.MinusToken,
              ts.factory.createNumericLiteral(Math.abs(number).toString())
            )
          : ts.factory.createNumericLiteral(number.toString())
      );
      if (comment) {
        addCommentBlockAsJsDoc(member, comment);
      }
      members.push(member);
    }
    return ts.factory.createEnumDeclaration(modifiers, name, members);
  }

  private validate() {
    if (
      this.values.map((v) => v.name).some((name, i, a) => a.indexOf(name) !== i)
    )
      throw new Error('duplicate names');
    let ei: rt.EnumInfo[1] = {};
    for (let v of this.values) {
      ei[v.number] = v.name;
      ei[v.name] = v.number;
    }
    if (!rt.isEnumObject(ei)) {
      throw new Error('not a typescript enum object');
    }
  }
}
