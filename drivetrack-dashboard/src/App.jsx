import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Trips from './pages/Trips'
import Drivers from './pages/Drivers'
import Analytics from './pages/Analytics'
import LiveMap from './pages/LiveMap'

function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/map" element={<LiveMap />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
