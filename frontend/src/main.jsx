import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles.css'
import { BedDataProvider } from './lib/BedData'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <BedDataProvider>
        <App />
      </BedDataProvider>
    </BrowserRouter>
  </StrictMode>,
)
