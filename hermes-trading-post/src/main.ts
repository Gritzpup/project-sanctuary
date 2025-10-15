import { mount } from 'svelte'
import './app.css'
import './styles/index.css'
import App from './App.svelte'
import { setupExtensionErrorHandler, identifyProblematicExtensions } from './utils/extensionErrorHandler'
import { initializeServiceWorker } from './services/serviceWorkerRegistration'

// Setup extension error handling before app initialization
setupExtensionErrorHandler()

// Initialize service worker for advanced HTTP caching
initializeServiceWorker().catch(err => {
  console.error('Service worker initialization failed:', err)
})

// Identify any problematic extensions after a short delay
setTimeout(() => {
  identifyProblematicExtensions()
}, 1000)

const app = mount(App, {
  target: document.getElementById('app')!,
  props: {
    url: window.location.pathname
  }
})

export default app
