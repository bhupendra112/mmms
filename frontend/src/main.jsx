import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store/store'
import './index.css'
import App from './App.jsx'

// Chromium throws this when a browser extension's async message listener never calls
// sendResponse — it is not from application code. Suppress so production consoles stay usable.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const r = event.reason
    const msg = typeof r?.message === 'string' ? r.message : String(r ?? '')
    if (
      msg.includes('message channel closed') &&
      msg.includes('asynchronous response')
    ) {
      event.preventDefault()
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
