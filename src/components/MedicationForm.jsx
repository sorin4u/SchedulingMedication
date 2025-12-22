import { useState, useEffect } from 'react';
import API_URL from '../config';
import './MedicationForm.css';

function MedicationForm({ medication, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: '',
    time: '',
    quantity: '',
    quantity_left: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (medication) {
      setFormData({
        name: medication.name || '',
        dosage: medication.dosage || '',
        frequency: medication.frequency || '',
        time: medication.start_datetime ? new Date(medication.start_datetime).toISOString().slice(0, 16) : '',
        quantity: medication.coantiti || '',
        quantity_left: medication.coantiti_left || '',
        notes: medication.notes || '',
      });
    }
  }, [medication]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const url = medication
        ? `${API_URL}/api/medications/${medication.id}`
        : `${API_URL}/api/medications`;
      
      const method = medication ? 'PUT' : 'POST';

      // Transform formData to match server expectations
      const payload = {
        name: formData.name,
        dosage: formData.dosage,
        frequency: formData.frequency,
        time: formData.time, // This will be stored as start_datetime in the database
        notes: formData.notes,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save medication');
      }

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{medication ? 'Edit Medication' : 'Add Medication'}</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">
              Medication Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Aspirin"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dosage">Dosage</label>
              <input
                type="text"
                id="dosage"
                name="dosage"
                value={formData.dosage}
                onChange={handleChange}
                placeholder="e.g., 500mg"
              />
            </div>

            <div className="form-group">
              <label htmlFor="time">Date & Time</label>
              <input
                type="datetime-local"
                id="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="quantity">Quantity</label>
            <input
              type="number"
              id="quantity"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="e.g., 30"
            />
          </div>

          <div className="form-group">
            <label htmlFor="quantity_left">Quantity Left</label>
            <input
              type="number"
              id="quantity_left"
              name="quantity_left"
              value={formData.quantity_left}
              onChange={handleChange}
              placeholder="e.g., 15"
            />
          </div>

          <div className="form-group">
            <label htmlFor="frequency">Frequency</label>
            <select
              id="frequency"
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
            >
              <option value="">Select frequency</option>
              <option value="Once daily">Once daily</option>
              <option value="Twice daily">Twice daily</option>
              <option value="Three times daily">Three times daily</option>
              <option value="Four times daily">Four times daily</option>
              <option value="Every 4 hours">Every 4 hours</option>
              <option value="Every 6 hours">Every 6 hours</option>
              <option value="Every 8 hours">Every 8 hours</option>
              <option value="Every 12 hours">Every 12 hours</option>
              <option value="As needed">As needed</option>
              <option value="Weekly">Weekly</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              placeholder="Any additional notes or instructions..."
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Saving...' : medication ? 'Update' : 'Add Medication'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MedicationForm;

//cd 'c:\Users\sorin\Desktop\React app\SchedulingMedication'; git add .; git commit -m "second commit"; git push