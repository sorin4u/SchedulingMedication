import { useState, useEffect } from 'react';
import MedicationForm from './MedicationForm';
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

  const fetchMedications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/medications', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch medications');
      }

      const data = await response.json();
      setMedications(data);
      setError('');
    } catch (err) {
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
      const response = await fetch(`http://localhost:3000/api/medications/${id}`, {
        method: 'DELETE',
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

  if (loading) {
    return <div className="loading">Loading medications...</div>;
  }

  return (
    <div className="medication-list-container">
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
            <div key={medication.id} className="medication-card">
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
                {medication.time && (
                  <div className="detail-item">
                    <span className="label">Time:</span>
                    <span className="value">{medication.time}</span>
                  </div>
                )}
                {medication.notes && (
                  <div className="detail-item notes">
                    <span className="label">Notes:</span>
                    <span className="value">{medication.notes}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MedicationList;
