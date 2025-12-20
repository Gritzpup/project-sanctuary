import { mount } from 'svelte'
import './app.css'
import './styles/index.css'
import App from './App.svelte'
import { setupExtensionErrorHandler, identifyProblematicExtensions } from './utils/extensionErrorHandler'
import { initializeServiceWorker } from './services/serviceWorkerRegistration'
import { initializeApp, getAppStatus } from './services/initialization/AppInitializer'
import { registerAppStores } from './stores/app/appStores'

// 🚀 PHASE 18-21: Setup and initialize all app systems
async function startApp() {
  // Step 1: Setup extension error handling before anything else
  setupExtensionErrorHandler()

  // Step 2: Register app stores (Phase 18)
  registerAppStores()

  // Step 3: Initialize all application systems (Phases 18-21)
  try {
    await initializeApp()
    console.log('[main] ✅ App systems initialized:', getAppStatus())
  } catch (error) {
    console.error('[main] ❌ App initialization failed:', error)
    // Continue anyway - app can still run with reduced functionality
  }

  // Step 4: Initialize service worker for advanced HTTP caching
  initializeServiceWorker().catch((err) => {
    console.error('[main] Service worker initialization failed:', err)
  })

  // Step 5: Identify any problematic extensions after a short delay
  setTimeout(() => {
    identifyProblematicExtensions()
  }, 1000)

  // Step 6: Mount the Svelte app
  const app = mount(App, {
    target: document.getElementById('app')!,
    props: {
      url: window.location.pathname
    }
  })

  // Step 7: Setup app shutdown on page unload (cleanup)
  window.addEventListener('beforeunload', async () => {
    const { shutdownApp } = await import('./services/initialization/AppInitializer')
    shutdownApp().catch((err) => console.error('[main] Shutdown error:', err))
  })

  return app
}

// Start the app
const appPromise = startApp()
export default appPromise
