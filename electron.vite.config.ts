import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// Copy pdfjs worker to build output so it can be dynamically imported at runtime
function copyPdfWorker() {
  const src = resolve(__dirname, 'node_modules/pdf-parse/node_modules/pdfjs-dist/build/pdf.worker.mjs')
  const outDir = resolve(__dirname, 'out/main')
  const dest = resolve(outDir, 'pdf.worker.mjs')
  return {
    name: 'copy-pdf-worker',
    closeBundle() {
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
      if (existsSync(src)) {
        copyFileSync(src, dest)
        console.log('  ✓ Copied pdf.worker.mjs to out/main/')
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [copyPdfWorker()],
    build: {
      rollupOptions: {
        input: {
          index: 'src/main/index.ts'
        },
        external: ['electron', 'electron-store']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: 'src/preload/index.ts'
        },
        external: ['electron']
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: 'src/renderer/index.html'
        }
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
