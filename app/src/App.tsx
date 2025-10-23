import { Navigate, Route, Routes } from 'react-router-dom'
import { ToastHost } from './components/ToastHost'
import { WalletConnectButton } from './components/WalletConnectButton'
import { Dashboard } from './pages/Dashboard'

const App = () => (
  <div className="app-shell">
    <header className="header">
      <div>
        <div className="brand">
          SkillStake <span className="text-accent">dApp</span>
        </div>
        <div className="text-muted" style={{ fontSize: '0.9rem' }}>
          Stake, earn, and manage your SkillStake tokens on Solana devnet.
        </div>
      </div>
      <WalletConnectButton />
    </header>

    <main className="app-main">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>

    <ToastHost />
  </div>
)

export default App
