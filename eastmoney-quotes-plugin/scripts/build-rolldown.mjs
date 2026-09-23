/** One-off rolldown build equivalent to tsdown.config.ts (unrun dep missing). */
import { createRequire } from 'node:module'
import path from 'node:path'

const require_ = createRequire(import.meta.url)
const tsdownPnpm = '/Users/lijiazhu/Documents/workspaces/github/deepseek-harness/node_modules/.pnpm/tsdown@0.22.2_oxc-resolver@11.20.0_publint@0.3.21_tsx@4.22.4_typescript@6.0.3/node_modules'
const { rolldown } = await import(path.join(tsdownPnpm, 'rolldown/dist/index.mjs'))

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

const root = path.resolve(new URL('.', import.meta.url).pathname, '..')

{
  const bundle = await rolldown({
    input: path.join(root, 'src/index.ts'),
    external: (id) => /^@deepseek-ai\//u.test(id),
    platform: 'node',
  })
  await bundle.write({ dir: path.join(root, 'lib'), format: 'esm', entryFileNames: 'index.js', sourcemap: false })
  await bundle.close()
  console.log('built lib/index.js')
}

{
  const bundle = await rolldown({
    input: path.join(root, 'src/client/index.ts'),
    external: (id) => TABLE.has(id),
    platform: 'browser',
    transform: { jsx: 'react-jsx' },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.env.MODE': JSON.stringify('production'),
      'import.meta.env': '{"MODE":"production"}',
    },
  })
  await bundle.write({
    dir: path.join(root, 'lib'),
    format: 'cjs',
    entryFileNames: 'client.js',
    sourcemap: true,
    banner: 'window.__ModuleLoader__.load({ id: "eastmoney-quotes-panel", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  })
  await bundle.close()
  console.log('built lib/client.js')
}
