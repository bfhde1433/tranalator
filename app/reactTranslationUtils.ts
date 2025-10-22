import { parse } from '@babel/parser';
import generate from '@babel/generator';
import * as t from '@babel/types';

const PARSER_OPTIONS = {
  sourceType: 'module' as const,
  plugins: ['typescript', 'jsx'] as const,
};

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export type ReactTranslationFormat =
  | 'export-default-object'
  | 'export-default-identifier'
  | 'named-export'
  | 'module-exports';

export interface ReactTranslationFileInfo {
  format: ReactTranslationFormat;
  identifier?: string;
  originalCode: string;
}

export interface ReactTranslationParseResult {
  data: JsonObject;
  info: ReactTranslationFileInfo;
}

export function parseReactTranslationFile(code: string): ReactTranslationParseResult {
  const ast = parse(code, {
    ...PARSER_OPTIONS,
  });

  for (const node of ast.program.body) {
    if (node.type === 'ExportDefaultDeclaration') {
      const declaration = node.declaration;
      if (declaration.type === 'ObjectExpression') {
        const data = nodeToValue(declaration);
        return {
          data,
          info: {
            format: 'export-default-object',
            originalCode: code,
          },
        };
      }

      if (declaration.type === 'TSAsExpression' || declaration.type === 'TSSatisfiesExpression') {
        const data = nodeToValue(declaration.expression);
        return {
          data,
          info: {
            format: 'export-default-object',
            originalCode: code,
          },
        };
      }

      if (declaration.type === 'Identifier') {
        const identifier = declaration.name;
        const declarator = findVariableDeclarator(ast.program.body, identifier);
        if (declarator && declarator.init) {
          const init = unwrapExpression(declarator.init);
          const data = nodeToValue(init);
          return {
            data,
            info: {
              format: 'export-default-identifier',
              identifier,
              originalCode: code,
            },
          };
        }
      }
    }

    if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration') {
      const firstDeclaration = node.declaration.declarations[0];
      if (
        firstDeclaration &&
        firstDeclaration.id.type === 'Identifier' &&
        firstDeclaration.init
      ) {
        const identifier = firstDeclaration.id.name;
        const init = unwrapExpression(firstDeclaration.init);
        const data = nodeToValue(init);
        return {
          data,
          info: {
            format: 'named-export',
            identifier,
            originalCode: code,
          },
        };
      }
    }

    if (
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'AssignmentExpression' &&
      node.expression.operator === '=' &&
      isModuleExports(node.expression.left)
    ) {
      const init = unwrapExpression(node.expression.right);
      const data = nodeToValue(init);
      return {
        data,
        info: {
          format: 'module-exports',
          originalCode: code,
        },
      };
    }
  }

  throw new Error('Unable to locate translation object in React translation file.');
}

export function generateReactTranslationFile(
  data: JsonObject,
  info: ReactTranslationFileInfo
): string {
  const ast = parse(info.originalCode, {
    ...PARSER_OPTIONS,
  });

  let replaced = false;

  const createObjectExpression = () => valueToNode(data);

  for (const node of ast.program.body) {
    if (info.format === 'export-default-object' && node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'TSAsExpression' || node.declaration.type === 'TSSatisfiesExpression') {
        node.declaration.expression = createObjectExpression();
      } else {
        node.declaration = createObjectExpression();
      }
      replaced = true;
      break;
    }

    if (info.format === 'export-default-identifier' && node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations) {
        if (
          declarator.id.type === 'Identifier' &&
          declarator.id.name === info.identifier &&
          declarator.init
        ) {
          if (
            declarator.init.type === 'TSAsExpression' ||
            declarator.init.type === 'TSSatisfiesExpression'
          ) {
            declarator.init.expression = createObjectExpression();
          } else {
            declarator.init = createObjectExpression();
          }
          replaced = true;
          break;
        }
      }
      if (replaced) break;
    }

    if (info.format === 'named-export') {
      if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration') {
        for (const declarator of node.declaration.declarations) {
          if (
            declarator.id.type === 'Identifier' &&
            declarator.id.name === info.identifier &&
            declarator.init
          ) {
            if (
              declarator.init.type === 'TSAsExpression' ||
              declarator.init.type === 'TSSatisfiesExpression'
            ) {
              declarator.init.expression = createObjectExpression();
            } else {
              declarator.init = createObjectExpression();
            }
            replaced = true;
            break;
          }
        }
        if (replaced) break;
      }
    }

    if (
      info.format === 'module-exports' &&
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'AssignmentExpression' &&
      node.expression.operator === '=' &&
      isModuleExports(node.expression.left)
    ) {
      if (
        node.expression.right.type === 'TSAsExpression' ||
        node.expression.right.type === 'TSSatisfiesExpression'
      ) {
        node.expression.right.expression = createObjectExpression();
      } else {
        node.expression.right = createObjectExpression();
      }
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    throw new Error('Failed to update React translation structure for export type.');
  }

  const output = generate(ast, {
    retainLines: true,
    comments: true,
    concise: false,
    jsescOption: {
      minimal: true,
    },
  }).code;

  return output.endsWith('\n') ? output : `${output}\n`;
}

function findVariableDeclarator(
  body: t.Statement[],
  identifier: string
): t.VariableDeclarator | undefined {
  for (const statement of body) {
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        if (declarator.id.type === 'Identifier' && declarator.id.name === identifier) {
          return declarator;
        }
      }
    }
  }
  return undefined;
}

function unwrapExpression(expression: t.Expression): t.Expression {
  if (expression.type === 'TSAsExpression' || expression.type === 'TSSatisfiesExpression') {
    return unwrapExpression(expression.expression);
  }
  if (expression.type === 'ParenthesizedExpression') {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function nodeToValue(node: t.Node): JsonValue {
  if (node.type === 'ObjectExpression') {
    const result: JsonObject = {};
    for (const property of node.properties) {
      if (property.type === 'ObjectProperty') {
        const key = propertyKeyToString(property.key);
        const value = nodeToValue(property.value);
        result[key] = value;
      } else if (property.type === 'SpreadElement') {
        throw new Error('Spread elements are not supported in translation files.');
      } else if (property.type === 'ObjectMethod') {
        throw new Error('Object methods are not supported in translation files.');
      }
    }
    return result;
  }

  if (node.type === 'ArrayExpression') {
    return node.elements.map<JsonValue>((element) => {
      if (!element) return null;
      if (element.type === 'SpreadElement') {
        throw new Error('Spread elements are not supported in translation arrays.');
      }
      return nodeToValue(element);
    });
  }

  if (node.type === 'StringLiteral') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral') {
    if (node.expressions.length > 0) {
      throw new Error('Template literals with expressions are not supported.');
    }
    return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
  }

  if (node.type === 'NumericLiteral') {
    return node.value;
  }

  if (node.type === 'BooleanLiteral') {
    return node.value;
  }

  if (node.type === 'NullLiteral') {
    return null;
  }

  if (node.type === 'Identifier') {
    if (node.name === 'undefined') {
      return null;
    }
    throw new Error(`Unsupported identifier value "${node.name}" in translation file.`);
  }

  if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression') {
    return nodeToValue(node.expression);
  }

  if (node.type === 'ParenthesizedExpression') {
    return nodeToValue(node.expression);
  }

  throw new Error(`Unsupported node type "${node.type}" in translation file.`);
}

function valueToNode(value: JsonValue): t.Expression {
  if (value === null || value === undefined) {
    return t.nullLiteral();
  }

  if (Array.isArray(value)) {
    return t.arrayExpression(value.map((item) => valueToNode(item)));
  }

  const typeOfValue = typeof value;

  if (typeOfValue === 'string') {
    return t.stringLiteral(value as string);
  }

  if (typeOfValue === 'number') {
    return t.numericLiteral(value as number);
  }

  if (typeOfValue === 'boolean') {
    return t.booleanLiteral(value as boolean);
  }

  if (typeOfValue === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => {
      const keyNode = t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key);
      return t.objectProperty(keyNode, valueToNode(val));
    });
    return t.objectExpression(entries);
  }

  throw new Error(`Unsupported value type "${typeOfValue}" when generating translation file.`);
}

function propertyKeyToString(node: t.Expression | t.PrivateName): string {
  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'StringLiteral') {
    return node.value;
  }

  if (node.type === 'NumericLiteral') {
    return String(node.value);
  }

  throw new Error('Unsupported property key in translation file.');
}

function isModuleExports(node: t.Expression): node is t.MemberExpression {
  if (node.type !== 'MemberExpression') {
    return false;
  }
  return (
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'module' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'exports'
  );
}
