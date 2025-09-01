import { mount } from 'svelte'
import './app.css'
import App from './App.router.svelte'
import { setupExtensionErrorHandler, identifyProblematicExtensions } from './utils/extensionErrorHandler'

// Setup extension error handling before app initialization
setupExtensionErrorHandler()

// Identify any problematic extensions after a short delay
setTimeout(() => {
  identifyProblematicExtensions()
}, 1000)

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app