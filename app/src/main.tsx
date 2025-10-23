import './polyfills'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import App from './App'
import { SolanaProvider } from './providers/SolanaProvider'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RecoilRoot>
      <BrowserRouter>
        <SolanaProvider>
          <App />
        </SolanaProvider>
      </BrowserRouter>
    </RecoilRoot>
  </React.StrictMode>,
)
