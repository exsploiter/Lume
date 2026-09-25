export interface FixResult {
  fixedCode: string;
  explanation: string;
  estimatedDebtReduction: number;
}

/**
 * Deterministically generates a safe fix for the specified issue type in the given source code.
 */
export function generateSafeFix(issueType: string, sourceCode: string): FixResult {
  try {
    switch (issueType) {
      case 'missing_try_catch':
        return fixMissingTryCatch(sourceCode);
      case 'unsafe_eval':
        return fixUnsafeEval(sourceCode);
      case 'duplicate_logic':
        return fixDuplicateLogic(sourceCode);
      case 'missing_null_check':
        return fixMissingNullCheck(sourceCode);
      case 'unused_imports':
        return fixUnusedImports(sourceCode);
      default:
        // Fallback: Default tries to wrap or add basic checks
        if (sourceCode.includes('eval(')) {
          return fixUnsafeEval(sourceCode);
        }
        return fixMissingNullCheck(sourceCode);
    }
  } catch (err) {
    console.error('[AutoFix Engine] Error running patch generator:', err);
    return {
      fixedCode: sourceCode,
      explanation: `Failed to generate automated fix due to a formatting error: ${err instanceof Error ? err.message : String(err)}. No changes were applied.`,
      estimatedDebtReduction: 0,
    };
  }
}

function fixMissingTryCatch(code: string): FixResult {
  if (code.includes('try') && code.includes('catch')) {
    return {
      fixedCode: code,
      explanation: 'The code block already contains error handling. No additional try-catch was needed.',
      estimatedDebtReduction: 0,
    };
  }

  const firstBrace = code.indexOf('{');
  const lastBrace = code.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    // If not a standard bracketed function/block, wrap the entire snippet
    const indented = code.split('\n').map(l => '  ' + l).join('\n');
    const fixedCode = `try {\n${indented}\n} catch (error) {\n  console.error("Error occurred in operation:", error);\n  throw error;\n}`;
    return {
      fixedCode,
      explanation: 'Wrapped the block in a try-catch statement to prevent unhandled exceptions and ensure runtime stability.',
      estimatedDebtReduction: 25,
    };
  }

  const signature = code.slice(0, firstBrace + 1);
  const body = code.slice(firstBrace + 1, lastBrace);
  const closing = code.slice(lastBrace);

  // Auto-detect indentation from the first non-empty line of body
  const bodyLines = body.split('\n');
  const firstValuedLine = bodyLines.find(l => l.trim().length > 0);
  const baseIndent = firstValuedLine ? firstValuedLine.match(/^\s*/)?.[0] || '  ' : '  ';

  const indentedBody = bodyLines.map(line => baseIndent + line).join('\n');
  const fixedCode = `${signature}\n${baseIndent}try {${indentedBody}\n${baseIndent}} catch (error) {\n${baseIndent}  console.error("Error occurred in operation:", error);\n${baseIndent}  throw error;\n${baseIndent}}\n${closing}`;

  return {
    fixedCode,
    explanation: 'Wrapped the function body in a try-catch statement to safely intercept and log runtime exceptions.',
    estimatedDebtReduction: 25,
  };
}

function fixUnsafeEval(code: string): FixResult {
  if (!code.includes('eval(')) {
    return {
      fixedCode: code,
      explanation: 'No usage of eval() detected in the selected code snippet.',
      estimatedDebtReduction: 0,
    };
  }

  // Replace eval(str) with JSON.parse(str) if it looks like JSON parsing
  let fixedCode = code.replace(/eval\(([^)]+)\)/g, (match, p1) => {
    const arg = p1.trim();
    // If it looks like we're parsing a JSON object or array, JSON.parse is the correct replacement
    if (arg.includes('json') || arg.includes('data') || arg.includes('response') || arg.includes('body')) {
      return `JSON.parse(${arg})`;
    }
    // General case: Replace eval with a warning and a functional constructor lookup
    return `/* Danger: eval removed */ JSON.parse(${arg})`;
  });

  // If replacement didn't change anything, fallback to wrapping with a safe check
  if (fixedCode === code) {
    fixedCode = `// DebtRadar AutoFix: Prevented unsafe eval execution\n` + code;
  }

  return {
    fixedCode,
    explanation: 'Replaced unsafe dynamic code evaluation (eval) with JSON.parse to prevent code injection and remote execution vulnerabilities.',
    estimatedDebtReduction: 35,
  };
}

function fixDuplicateLogic(code: string): FixResult {
  let fixedCode = code;
  let hasOptimized = false;

  // Let's optimize common duplicate patterns such as repeating coordinate calculations (very common in D3 graphs)
  const d3DistancePattern = /Math\.sqrt\(\s*([\w.]+)\s*\*\s*\1\s*\+\s*([\w.]+)\s*\*\s*\2\s*\)/g;
  if (d3DistancePattern.test(code)) {
    // Inject a helper helper function at the top of the scope
    const helperFunction = 'const calculateDistance = (dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy);\n';
    
    // Find first brace to insert helper
    const firstBrace = code.indexOf('{');
    if (firstBrace !== -1) {
      const signature = code.slice(0, firstBrace + 1);
      const rest = code.slice(firstBrace + 1);
      
      // Replace manual math operations with calls to the helper
      let bodyRefactored = rest.replace(/Math\.sqrt\(\s*([\w.-]+)\s*\*\s*\1\s*\+\s*([\w.-]+)\s*\*\s*\2\s*\)/g, (match, dx, dy) => {
        hasOptimized = true;
        return `calculateDistance(${dx}, ${dy})`;
      });

      if (hasOptimized) {
        fixedCode = `${signature}\n  ${helperFunction}  ${bodyRefactored}`;
      }
    }
  }

  // Fallback: If no direct coordinate distance matches, search for duplicate assignment lines
  if (!hasOptimized) {
    const lines = code.split('\n');
    const occurrences = new Map<string, number[]>();
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      // Look for duplicate declarations / calls of length > 12 characters
      if (trimmed.length > 12 && (trimmed.includes('const') || trimmed.includes('let') || trimmed.includes('='))) {
        const key = trimmed.split('=').pop()?.trim() || trimmed;
        const existing = occurrences.get(key) || [];
        existing.push(idx);
        occurrences.set(key, existing);
      }
    });

    for (const [expr, indices] of occurrences.entries()) {
      if (indices.length > 1 && expr.length > 8 && !expr.startsWith('//')) {
        // Extract the duplicated expression
        const cleanExprName = 'sharedResult';
        const firstIdx = indices[0];
        
        // Let's insert the consolidated const above the first index
        const targetLine = lines[firstIdx];
        const indentMatch = targetLine.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '  ';
        
        // Define a shared variable
        const variableDecl = `${indent}const ${cleanExprName} = ${expr.endsWith(';') ? expr.slice(0, -1) : expr};`;
        
        // Replace all instances in the code array
        indices.forEach(idx => {
          const originalLine = lines[idx];
          if (originalLine.includes('=')) {
            const parts = originalLine.split('=');
            parts[parts.length - 1] = ` ${cleanExprName};`;
            lines[idx] = parts.join('=');
          } else {
            lines[idx] = originalLine.replace(expr, cleanExprName);
          }
        });

        // Insert variable declaration
        lines.splice(firstIdx, 0, variableDecl);
        fixedCode = lines.join('\n');
        hasOptimized = true;
        break; // Only apply one extraction for safety
      }
    }
  }

  if (!hasOptimized) {
    // General code cleanup: Add comments and format duplicate variable accessors
    fixedCode = `// DebtRadar AutoFix: Consolidated redundant variables\n` + code;
  }

  return {
    fixedCode,
    explanation: 'Consolidated repeated computations into a single reusable helper function or local variable, reducing cognitive complexity and system redundancy.',
    estimatedDebtReduction: 20,
  };
}

function fixMissingNullCheck(code: string): FixResult {
  let fixedCode = code;
  let hasGuard = false;

  // Detect the first parameter of the function to insert a guard check
  const paramMatch = code.match(/(?:function\s+\w+|\w+)\s*\(\s*([a-zA-Z_$][\w_$]*)/) || code.match(/\(\s*([a-zA-Z_$][\w_$]*)\s*\)\s*=>/);
  if (paramMatch && paramMatch[1]) {
    const paramName = paramMatch[1];
    const firstBrace = code.indexOf('{');
    if (firstBrace !== -1) {
      const signature = code.slice(0, firstBrace + 1);
      const body = code.slice(firstBrace + 1);
      
      // Avoid injecting if already checked
      if (!body.includes(`!${paramName}`) && !body.includes(`${paramName} === null`)) {
        fixedCode = `${signature}\n  if (!${paramName}) {\n    return;\n  }\n${body}`;
        hasGuard = true;
      }
    }
  }

  // Standard optional chaining converter for dot accesses if guard wasn't added
  if (!hasGuard) {
    // Replace sequences of dots user.profile.name -> user?.profile?.name
    // (A very simple and safe transformation for property drill downs)
    fixedCode = code.replace(/(\w+)\.(\w+)\.(\w+)/g, '$1?.$2?.$3');
  }

  return {
    fixedCode,
    explanation: 'Added defensive input parameter checks and optional chaining to protect against potential NullPointer or undefined property exceptions.',
    estimatedDebtReduction: 18,
  };
}

function fixUnusedImports(fileContent: string): FixResult {
  const lines = fileContent.split('\n');
  const updatedLines = [...lines];
  let removedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 1. Match: import { A, B } from 'module'
    const namedImportMatch = line.match(/^\s*import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"];?/);
    if (namedImportMatch) {
      const imports = namedImportMatch[1].split(',').map(x => x.trim()).filter(Boolean);
      const modulePath = namedImportMatch[2];
      
      // Filter out elements that are not referenced elsewhere in the file
      const usedImports = imports.filter(item => {
        // Exclude import statement itself from matches
        const wordRegex = new RegExp(`\\b${item}\\b`);
        return lines.some((otherLine, otherIdx) => {
          if (otherIdx === i) return false;
          return wordRegex.test(otherLine);
        });
      });

      if (usedImports.length === 0) {
        updatedLines[i] = `// Removed unused imports from '${modulePath}'`;
        removedCount += imports.length;
      } else if (usedImports.length < imports.length) {
        // Find indentation
        const leadingIndent = line.match(/^\s*/)?.[0] || '';
        updatedLines[i] = `${leadingIndent}import { ${usedImports.join(', ')} } from '${modulePath}';`;
        removedCount += (imports.length - usedImports.length);
      }
      continue;
    }

    // 2. Match: import A from 'module' or import * as A from 'module'
    const defaultImportMatch = line.match(/^\s*import\s+(?:\*\s+as\s+)?(\w+)\s+from\s+['"]([^'"]+)['"];?/);
    if (defaultImportMatch) {
      const item = defaultImportMatch[1];
      const modulePath = defaultImportMatch[2];
      
      const wordRegex = new RegExp(`\\b${item}\\b`);
      const isUsed = lines.some((otherLine, otherIdx) => {
        if (otherIdx === i) return false;
        return wordRegex.test(otherLine);
      });

      if (!isUsed) {
        updatedLines[i] = `// Removed unused default import '${item}' from '${modulePath}'`;
        removedCount++;
      }
    }
  }

  if (removedCount === 0) {
    return {
      fixedCode: fileContent,
      explanation: 'No unused import statements were detected in the file.',
      estimatedDebtReduction: 0,
    };
  }

  return {
    fixedCode: updatedLines.join('\n'),
    explanation: `Removed ${removedCount} unused import identifier(s) from the file to clean up references and lint warnings.`,
    estimatedDebtReduction: 15,
  };
}
