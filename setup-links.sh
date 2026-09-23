#!/bin/bash
# 重建两个插件包的 node_modules 符号链接（借用 deepseek-harness 仓库的依赖与构建器）。
# 用法: ./setup-links.sh [deepseek-harness 仓库路径，默认为同级的 deepseek-harness]
set -e
HARNESS="${1:-$(cd "$(dirname "$0")" && pwd)/../deepseek-harness}"
HARNESS="$(cd "$HARNESS" && pwd)"
echo "harness repo: $HARNESS"

for PLUGIN in glm-usage-plugin eastmoney-quotes-plugin btw-plugin; do
  P="$PWD/$PLUGIN/node_modules"
  rm -rf "$P"
  mkdir -p "$P/@deepseek-ai" "$P/@types"
  cd "$P/@deepseek-ai"
  ln -sfn "$HARNESS/vendor/cordis" cordis
  ln -sfn "$HARNESS/vendor/schemastery" schemastery
  ln -sfn "$HARNESS/packages/client/ui-slots" dsh-client-ui-slots
  ln -sfn "$HARNESS/packages/client/ui-primitives" dsh-client-ui-primitives
  ln -sfn "$HARNESS/packages/client/locale" dsh-client-locale
  ln -sfn "$HARNESS/packages/client/ui-settings" dsh-client-ui-settings
  ln -sfn "$HARNESS/packages/client/ui-renderer" dsh-client-ui-renderer
  ln -sfn "$HARNESS/packages/client/ui-sidebar" dsh-client-ui-sidebar
  ln -sfn "$HARNESS/packages/client/ui-conversation" dsh-client-ui-conversation
  ln -sfn "$HARNESS/packages/client/ui-chat" dsh-client-ui-chat
  ln -sfn "$HARNESS/packages/client/ui-session" dsh-client-ui-session
  ln -sfn "$HARNESS/packages/llm/llm" dsh-llm
  ln -sfn "$HARNESS/packages/core/session" dsh-session
  ln -sfn "$HARNESS/packages/core/agent" dsh-agent
  ln -sfn "$HARNESS/packages/credentials/credentials" dsh-credentials
  ln -sfn "$HARNESS/packages/host/webserver" dsh-host-webserver
  ln -sfn "$HARNESS/packages/util/home-paths" dsh-home-paths
  cd "$P"
  ln -sfn "$HARNESS/node_modules/.pnpm/react@18.3.1/node_modules/react" react
  ln -sfn "$HARNESS/node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom" react-dom
  TR=$(ls -d "$HARNESS"/node_modules/.pnpm/@types+react@18*/node_modules/@types/react 2>/dev/null | head -1)
  TRD=$(ls -d "$HARNESS"/node_modules/.pnpm/@types+react-dom@18*/node_modules/@types/react-dom 2>/dev/null | head -1)
  ln -sfn "$TR" @types/react
  ln -sfn "$TRD" @types/react-dom
  NODE_TYPES=$(ls -d "$HARNESS"/node_modules/.pnpm/@types+node@*/node_modules/@types/node 2>/dev/null | head -1)
  ln -sfn "$NODE_TYPES" @types/node
  TSDOWN=$(ls -d "$HARNESS"/node_modules/.pnpm/tsdown@*/node_modules/tsdown 2>/dev/null | head -1)
  TSC=$(ls -d "$HARNESS"/node_modules/.pnpm/typescript@6*/node_modules/typescript 2>/dev/null | head -1)
  ln -sfn "$TSDOWN" tsdown
  ln -sfn "$TSC" typescript
  TSX=$(ls -d "$HARNESS"/node_modules/.pnpm/tsx@*/node_modules/tsx 2>/dev/null | head -1)
  ln -sfn "$TSX" tsx
  cd "$P/../.."
  echo "linked: $PLUGIN"
done
