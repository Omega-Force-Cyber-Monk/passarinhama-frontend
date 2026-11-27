import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Node 22.15+; use the existing TypeScript compiler without adding a test framework.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      for (const extension of ['.ts', '.tsx']) {
        if (existsSync(fileURLToPath(url) + extension)) {
          return { url: url.href + extension, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (/\.tsx?$/.test(url)) {
      const source = readFileSync(fileURLToPath(url), 'utf8')
        .replace('import.meta.env.VITE_API_BASE_URL', JSON.stringify('https://test.invalid'));
      return {
        format: 'module', shortCircuit: true,
        source: ts.transpileModule(source, { fileName: fileURLToPath(url), compilerOptions: {
          module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        } }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
