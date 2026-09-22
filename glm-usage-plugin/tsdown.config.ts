/** Build the Host (node ESM) and Client (lazy-CJS factory) faces of the plugin. */
import { defineConfig } from 'tsdown'

/** Module-table rows the client bundle may require at runtime instead of bundling. */
const TABLE = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'es2024',

    external: [/^@deepseek-ai\//u],
    clean: true,
    outputOptions: { entryFileNames: 'index.js' },
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    sourcemap: true,
    clean: false,
    external: (id: string) => TABLE.has(id),
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.env.MODE': '"production"',
      'import.meta.env': '{"MODE":"production"}',
    },
    outputOptions: { entryFileNames: 'client.js' },
    banner: 'window.__ModuleLoader__.load({ id: "glm-usage-panel", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
])
