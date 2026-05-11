import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const VIRTUAL_ID = 'virtual:git-hash'
const RESOLVED_ID = '\0' + VIRTUAL_ID

function getHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

function gitHashPlugin(): Plugin {
  return {
    name: 'git-hash',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id === RESOLVED_ID)
        return `export default ${JSON.stringify(getHash())}`
    },
    configureServer(server) {
      server.watcher.add('.git/HEAD')
      server.watcher.on('change', (file) => {
        if (!file.includes('.git')) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gitHashPlugin()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor';
          }
          if (id.includes('node_modules/zustand')) {
            return 'zustand';
          }
        },
      },
    },
  },
})
