import { useState, useEffect } from 'react';
import API_URL from '../config';
import MedicationForm from './MedicationForm';
import NotificationPrompt from './NotificationPrompt';
import { startMedicationReminders } from '../utils/notifications';
import './MedicationList.css';

function MedicationList() {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);

  useEffect(() => {
    fetchMedications();
  }, []);

  useEffect(() => {
    if (medications.length > 0) {
      const intervalId = startMedicationReminders(medications);
      return () => clearInterval(intervalId);
    }
  }, [medications]);

  const fetchMedications = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Please log in to view medications');
        setLoading(false);
        return;
      }
      
      console.log('Fetching medications from:', `${API_URL}/api/medications`);
      const response = await fetch(`${API_URL}/api/medications`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Response status:', response.status);

      if (response.status === 401 || response.status === 403) {
        // Token is invalid or expired - logout user
        localStorage.removeItem('token');
        window.location.href = '/';
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error:', errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Medications loaded:', data.length);
      setMedications(data);
      setError('');
    } catch (err) {
      console.error('Fetch medications error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this medication?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/medications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete medication');
      }

      setMedications(medications.filter(med => med.id !== id));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (medication) => {
    setEditingMedication(medication);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingMedication(null);
  };

  const handleFormSuccess = () => {
    fetchMedications();
    handleFormClose();
  };

  const handleMarkAsTaken = async (id, taken) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/medications/${id}/taken`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ taken }),
      });

      if (!response.ok) {
        throw new Error('Failed to update medication status');
      }

      const updatedMedication = await response.json();
      setMedications(medications.map(med => 
        med.id === id ? updatedMedication : med
      ));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="loading">Loading medications...</div>;
  }

  return (
    <div className="medication-list-container">
      <NotificationPrompt />
      
      <div className="medication-header">
        <h2>My Medications</h2>
        <button onClick={() => setShowForm(true)} className="add-btn">
          + Add Medication
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <MedicationForm
          medication={editingMedication}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {medications.length === 0 ? (
        <div className="empty-state">
          <p>No medications added yet.</p>
          <p>Click "Add Medication" to get started!</p>
        </div>
      ) : (
        <div className="medication-grid">
          {medications.map((medication) => (
            <div 
              key={medication.id} 
              className={`medication-card ${medication.taken_today ? 'taken' : ''}`}
            >
              <div className="medication-card-header">
                <h3>{medication.name}</h3>
                <div className="medication-actions">
                  <button
                    onClick={() => handleEdit(medication)}
                    className="edit-btn"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(medication.id)}
                    className="delete-btn"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="medication-details">
                {medication.dosage && (
                  <div className="detail-item">
                    <span className="label">Dosage:</span>
                    <span className="value">{medication.dosage}</span>
                  </div>
                )}
                {medication.frequency && (
                  <div className="detail-item">
                    <span className="label">Frequency:</span>
                    <span className="value">{medication.frequency}</span>
                  </div>
                )}
                {medication.start_datetime && (
                  <div className="detail-item">
                    <span className="label">Time:</span>
                    <span className="value">{new Date(medication.start_datetime).toLocaleString()}</span>
                  </div>
                )}
                {medication.quantity && (
                  <div className="detail-item">
                    <span className="label">Quantity:</span>
                    <span className="value">{medication.quantity}</span>
                  </div>
                )}
                {medication.quantity_left !== null && medication.quantity_left !== undefined && (
                  <div className="detail-item">
                    <span className="label">Pills Left:</span>
                    <span className="value" style={{ 
                      color: medication.quantity_left <= 5 ? '#e74c3c' : medication.quantity_left <= 10 ? '#f39c12' : '#27ae60',
                      fontWeight: 'bold'
                    }}>
                      {medication.quantity_left}
                      {medication.quantity_left <= 5 && ' ⚠️'}
                    </span>
                  </div>
                )}
                {medication.notes && (
                  <div className="detail-item notes">
                    <span className="label">Notes:</span>
                    <span className="value">{medication.notes}</span>
                  </div>
                )}
              </div>

              <div className="medication-footer">
                <button
                  onClick={() => handleMarkAsTaken(medication.id, !medication.taken_today)}
                  className={`taken-btn ${medication.taken_today ? 'taken' : ''}`}
                >
                  {medication.taken_today ? '✓ Taken Today' : 'Mark as Taken'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MedicationList;
