import * as acorn from 'acorn';
import { simple as walkSimple, ancestor as walkAncestor } from 'acorn-walk';
import type { ParsedFile, ASTSymbol } from '@/types';
import { symbolId } from '@/lib/utils';

const PARSE_OPTIONS: acorn.Options = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  locations: true,
};

export function parseRepository(files: ParsedFile[]): ASTSymbol[] {
  const symbols: ASTSymbol[] = [];
  const globalCalls: Map<string, Set<string>> = new Map();

  for (const file of files) {
    try {
      const ast = acorn.parse(file.content, PARSE_OPTIONS);
      const fileSymbols = extractSymbols(file.path, ast, file.content);
      symbols.push(...fileSymbols);

      const calls = extractCalls(ast);
      globalCalls.set(file.path, calls);
    } catch {
      symbols.push({
        id: symbolId(file.path, '__module__'),
        filePath: file.path,
        name: '__module__',
        type: 'module',
        lineStart: 1,
        lineEnd: file.content.split('\n').length,
        complexity: 1,
        calls: [],
        calledBy: [],
      });
    }
  }

  linkCallGraph(symbols, globalCalls);
  return symbols;
}

function extractSymbols(
  filePath: string,
  ast: acorn.Program,
  content: string
): ASTSymbol[] {
  const symbols: ASTSymbol[] = [];
  const lines = content.split('\n');

  walkSimple(ast, {
    FunctionDeclaration(node) {
      if (node.id?.name) {
        symbols.push(makeSymbol(filePath, node.id.name, 'function', node, lines));
      }
    },
    FunctionExpression(node) {
      if (node.id?.name) {
        symbols.push(makeSymbol(filePath, node.id.name, 'function', node, lines));
      }
    },
    MethodDefinition(node) {
      if (
        node.key.type === 'Identifier' &&
        node.kind !== 'constructor'
      ) {
        symbols.push(
          makeSymbol(filePath, node.key.name, 'function', node.value, lines)
        );
      }
    },
    ClassDeclaration(node) {
      if (node.id?.name) {
        symbols.push(makeSymbol(filePath, node.id.name, 'class', node, lines));
      }
    },
    VariableDeclarator(node) {
      if (
        node.id.type === 'Identifier' &&
        node.init &&
        (node.init.type === 'FunctionExpression' ||
          node.init.type === 'ArrowFunctionExpression')
      ) {
        symbols.push(
          makeSymbol(filePath, node.id.name, 'function', node.init, lines)
        );
      }
    },
  });

  if (symbols.length === 0) {
    symbols.push({
      id: symbolId(filePath, '__module__'),
      filePath,
      name: '__module__',
      type: 'module',
      lineStart: 1,
      lineEnd: lines.length,
      complexity: cyclomaticComplexity(ast),
      calls: [],
      calledBy: [],
    });
  }

  return symbols;
}

function makeSymbol(
  filePath: string,
  name: string,
  type: ASTSymbol['type'],
  node: acorn.Node,
  lines: string[]
): ASTSymbol {
  const loc = node.loc;
  const lineStart = loc?.start.line ?? 1;
  const lineEnd = loc?.end.line ?? lineStart;
  return {
    id: symbolId(filePath, name),
    filePath,
    name,
    type,
    lineStart,
    lineEnd,
    complexity: node.type.includes('Function') || node.type === 'MethodDefinition'
      ? cyclomaticComplexity(node)
      : 1,
    calls: [],
    calledBy: [],
  };
}

function cyclomaticComplexity(node: acorn.Node): number {
  let complexity = 1;
  walkAncestor(node as acorn.Node, {
    IfStatement() { complexity++; },
    ForStatement() { complexity++; },
    ForInStatement() { complexity++; },
    ForOfStatement() { complexity++; },
    WhileStatement() { complexity++; },
    DoWhileStatement() { complexity++; },
    SwitchCase() { complexity++; },
    CatchClause() { complexity++; },
    ConditionalExpression() { complexity++; },
    LogicalExpression(n) {
      if (n.operator === '&&' || n.operator === '||') complexity++;
    },
  });
  return complexity;
}

function extractCalls(ast: acorn.Program): Set<string> {
  const calls = new Set<string>();
  walkSimple(ast, {
    CallExpression(node) {
      if (node.callee.type === 'Identifier') {
        calls.add(node.callee.name);
      } else if (
        node.callee.type === 'MemberExpression' &&
        node.callee.property.type === 'Identifier'
      ) {
        calls.add(node.callee.property.name);
      }
    },
  });
  return calls;
}

function linkCallGraph(
  symbols: ASTSymbol[],
  fileCalls: Map<string, Set<string>>
): void {
  const nameIndex = new Map<string, ASTSymbol[]>();
  for (const sym of symbols) {
    const existing = nameIndex.get(sym.name) ?? [];
    existing.push(sym);
    nameIndex.set(sym.name, existing);
  }

  for (const sym of symbols) {
    const calls = fileCalls.get(sym.filePath);
    if (!calls) continue;
    for (const callName of calls) {
      const targets = nameIndex.get(callName) ?? [];
      for (const target of targets) {
        if (target.id !== sym.id) {
          sym.calls.push(target.id);
          target.calledBy.push(sym.id);
        }
      }
    }
  }
}

export function getCodeSnippet(
  content: string,
  lineStart: number,
  lineEnd: number
): string {
  const lines = content.split('\n');
  return lines.slice(lineStart - 1, lineEnd).join('\n');
}
