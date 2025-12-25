import { useState } from 'react'
import Login from './components/Login'
import MedicationList from './components/MedicationList'
import AdminDashboard from './components/AdminDashboard'
import API_URL from './config'
import './App.css'

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    return token && savedUser ? JSON.parse(savedUser) : null
  })
  
  const [currentView, setCurrentView] = useState('medications') // 'medications' or 'admin'

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = async () => {
    try {
      // Call logout endpoint to destroy session
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      // Clear local storage and state regardless of API call result
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
      setCurrentView('medications')
    }
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }
  
  if (currentView === 'admin' && user.is_admin) {
    return <AdminDashboard onLogout={handleLogout} onBack={() => setCurrentView('medications')} />
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Medication Scheduling</h1>
        <div className="user-info">
          <span>Welcome, {user.username}!</span>
          {user.is_admin && (
            <button onClick={() => setCurrentView('admin')} className="admin-btn">
              Admin Panel
            </button>
          )}
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
