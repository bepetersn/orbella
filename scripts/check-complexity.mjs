import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const DEFAULT_MAX = Infinity;
const DEFAULT_TARGETS = ['src'];
const DEFAULT_IGNORES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
const BRANCH_NODES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
]);
const LOGICAL_OPERATORS = new Set(['&&', '||', '??']);

const DEFAULT_LIMIT = 20;

const parseArgs = (argv) => {
  const args = [...argv];
  let limit = DEFAULT_LIMIT;
  let max = DEFAULT_MAX;
  const ignores = new Set(DEFAULT_IGNORES);
  const targets = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--limit') {
      const value = args[++i];
      const parsed = Number.parseInt(value, 10);

      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = parsed;
      } else {
        console.error(`Invalid value for --limit: ${value}`);
        process.exitCode = 1;
        return null;
      }
    } else if (arg === '--max') {
      const value = args[++i];
      const parsed = Number.parseInt(value, 10);

      if (!Number.isNaN(parsed) && parsed > 0) {
        max = parsed;
      } else {
        console.error(`Invalid value for --max: ${value}`);
        process.exitCode = 1;
        return null;
      }
    } else if (arg === '--ignore') {
      const value = args[++i];
      if (!value) {
        console.error(`Missing value for --ignore`);
        process.exitCode = 1;
        return null;
      }
      ignores.add(value);
    } else {
      targets.push(arg);
    }
  }

  return { targets, limit, max, ignores };
};

const resolveFunctionName = (node, parent) => {
  if (node.id?.name) return node.id.name;

  if (parent?.type === 'VariableDeclarator' && parent.id?.name) {
    return parent.id.name;
  }

  if (parent?.type === 'AssignmentExpression') {
    if (parent.left.type === 'Identifier') return parent.left.name;
    if (parent.left.type === 'MemberExpression' && !parent.left.computed) {
      return parent.left.property.name;
    }
  }

  if (parent?.type === 'Property' && !parent.computed) {
    if (parent.key.type === 'Identifier') return parent.key.name;
    if (parent.key.type === 'Literal') return String(parent.key.value);
  }

  return '<anonymous>';
};

const collectSourceFiles = (target, ignores) => {
  const stat = fs.statSync(target);

  if (stat.isFile()) {
    return /\.(mjs|js)$/.test(target) ? [target] : [];
  }

  if (!stat.isDirectory()) return [];

  const base = path.basename(target);
  if (ignores.has(base)) {
    return [];
  }

  return fs
    .readdirSync(target, { withFileTypes: true })
    .flatMap((entry) => {
      if (ignores.has(entry.name)) return [];

      const child = path.join(target, entry.name);
      return collectSourceFiles(child, ignores);
    })
    .sort();
};

const measureFile = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
  });
  const results = [];

  walk.ancestor(ast, {
    Function(node, ancestors) {
      const parent = ancestors.at(-2);
      let cc = 1;

      walk.full(node.body, (child) => {
        if (BRANCH_NODES.has(child.type)) {
          cc += 1;
        }

        if (child.type === 'LogicalExpression' && LOGICAL_OPERATORS.has(child.operator)) {
          cc += 1;
        }

        if (child.type === 'SwitchCase' && child.test) {
          cc += 1;
        }
      });

      results.push({
        file: filePath,
        name: resolveFunctionName(node, parent),
        line: node.loc.start.line,
        cc,
      });
    },
  });

  return results;
};

const formatRow = ({ file, name, line, cc }) =>
  `${String(cc).padStart(4)}  ${file}:${line}  ${name}`;

const main = () => {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) return;

  const { targets: cliTargets, limit, max, ignores } = parsed;
  const targets = cliTargets.length > 0 ? cliTargets : DEFAULT_TARGETS;

  const missing = targets.filter((target) => !fs.existsSync(target));
  if (missing.length > 0) {
    for (const target of missing) {
      console.error(`Missing file: ${target}`);
    }
    process.exitCode = 1;
    return;
  }

  const sourceFiles = targets.flatMap((target) =>
    collectSourceFiles(path.normalize(target), ignores)
  );

  const results = sourceFiles
    .flatMap((target) => measureFile(target))
    .sort(
      (a, b) =>
        b.cc - a.cc ||
        a.file.localeCompare(b.file) ||
        a.line - b.line ||
        a.name.localeCompare(b.name)
    );

  if (results.length === 0) {
    console.log('No functions found.');
    return;
  }

  // Find violations
  const violations = results.filter((r) => r.cc > max);

  // Print (still respect limit for display)
  const limited = results.slice(0, limit);

  console.log('  CC  Location  Function');
  console.log('----  --------  --------');
  for (const result of limited) {
    console.log(formatRow(result));
  }

  // Fail if needed
  if (violations.length > 0) {
    console.error(
      `\n❌ Cyclomatic complexity exceeded max of ${max} in ${violations.length} function(s).`
    );

    // optionally show the worst offenders
    for (const v of violations.slice(0, 5)) {
      console.error(`  ${formatRow(v)}`);
    }

    process.exitCode = 1;
  }
};

main();
