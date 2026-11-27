import './register-typescript.mjs';
await import(new URL(process.argv[2] ?? '../tests/article-authorization.test.ts', import.meta.url).href);
