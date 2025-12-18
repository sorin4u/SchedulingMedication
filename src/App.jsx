import { useState } from 'react'
import Login from './components/Login'
import MedicationList from './components/MedicationList'
import './App.css'

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    return token && savedUser ? JSON.parse(savedUser) : null
  })

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Medication Scheduling</h1>
        <div className="user-info">
          <span>Welcome, {user.username}!</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>
      
      <main className="app-content">
        <MedicationList />
      </main>
    </div>
  )
}

export default App
