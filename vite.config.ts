import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config.ts'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: {
    // Dev server only — has no effect on `npm run build`.
    //
    // Vite tightened its CORS defaults in 5.4.12 / 6.0.9 so that arbitrary origins can no
    // longer read from the dev server. The extension runs on a chrome-extension:// origin
    // and CRXJS's HMR client fetches back to localhost, so without this every extension
    // page fails with "No 'Access-Control-Allow-Origin' header is present".
    //
    // Scoped to the chrome-extension scheme rather than opened up to everything, since a
    // dev server that serves this project's source to any site you happen to visit is
    // exactly what that Vite change was closing off.
    cors: {
      origin: [/^chrome-extension:\/\//]
    }
  }
})
