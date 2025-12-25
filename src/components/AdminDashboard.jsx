import { useState, useEffect } from 'react';
import API_URL from '../config';
import './AdminDashboard.css';

function AdminDashboard({ onLogout, onBack }) {
  const [users, setUsers] = useState([]);
  const [medications, setMedications] = useState([]);
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'medications'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingMedId, setEditingMedId] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchMedications();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchMedications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/medications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch medications');
      }
      
      const data = await response.json();
      setMedications(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleAdmin = async (userId, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'remove' : 'grant'} admin access?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/admin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_admin: !currentStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update admin status');
      }

      await fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This will also delete all their medications.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      await fetchUsers();
      await fetchMedications();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBackToMedications = () => {
    // Call the onBack prop to navigate back to medications view
    if (onBack) {
      onBack();
    }
  };

  const handleEditQuantity = (medId, currentQuantity) => {
    setEditingMedId(medId);
    setEditQuantity(currentQuantity.toString());
  };

  const handleSaveQuantity = async (medId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/medications/${medId}/quantity`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ quantity_left: parseInt(editQuantity) })
      });

      if (!response.ok) {
        throw new Error('Failed to update quantity');
      }

      await fetchMedications();
      setEditingMedId(null);
      setEditQuantity('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingMedId(null);
    setEditQuantity('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return <div className="admin-dashboard"><p>Loading...</p></div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-header-actions">
          <button onClick={handleBackToMedications} className="back-btn">
            Back to Medications
          </button>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="admin-tabs">
        <button 
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Users ({users.length})
        </button>
        <button 
          className={activeTab === 'medications' ? 'active' : ''}
          onClick={() => setActiveTab('medications')}
        >
          All Medications ({medications.length})
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="users-section">
          <h2>User Management</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Admin</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`admin-badge ${user.is_admin ? 'is-admin' : ''}`}>
                      {user.is_admin ? '✓ Admin' : 'User'}
                    </span>
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>
                    <button 
                      onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                      className="toggle-admin-btn"
                    >
                      {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user.id, user.username)}
                      className="delete-btn"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'medications' && (
        <div className="medications-section">
          <h2>All Medications</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>User</th>
                <th>Email</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Quantity Left</th>
                <th>Start Date</th>
                <th>Last Reminder</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {medications.map(med => (
                <tr key={med.id}>
                  <td>{med.id}</td>
                  <td>{med.name}</td>
                  <td>{med.username}</td>
                  <td>{med.email}</td>
                  <td>{med.dosage}</td>
                  <td>{med.frequency}</td>
                  <td>
                    {editingMedId === med.id ? (
                      <input
                        type="number"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        className="quantity-input"
                        min="0"
                      />
                    ) : (
                      <span className={`quantity ${
                        med.quantity_left <= 5 ? 'low' : 
                        med.quantity_left <= 10 ? 'medium' : 
                        'high'
                      }`}>
                        {med.quantity_left}
                      </span>
                    )}
                  </td>
                  <td>{formatDate(med.start_datetime)}</td>
                  <td>{formatDate(med.last_notification_sent)}</td>
                  <td>
                    {editingMedId === med.id ? (
                      <>
                        <button 
                          onClick={() => handleSaveQuantity(med.id)}
                          className="save-btn"
                        >
                          Save
                        </button>
                        <button 
                          onClick={handleCancelEdit}
                          className="cancel-btn"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => handleEditQuantity(med.id, med.quantity_left)}
                        className="edit-btn"
                      >
                        Edit Qty
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
