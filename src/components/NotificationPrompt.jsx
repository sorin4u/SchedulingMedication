import { useState, useEffect } from 'react';
import { requestNotificationPermission } from '../utils/notifications';
import './NotificationPrompt.css';

function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'denied'
  );

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt || permission !== 'default') {
    return null;
  }

  return (
    <div className="notification-prompt">
      <div className="notification-prompt-content">
        <div className="notification-icon">🔔</div>
        <div className="notification-text">
          <h3>Enable Medication Reminders</h3>
          <p>Get notified when it's time to take your medications</p>
        </div>
        <div className="notification-actions">
          <button onClick={handleEnable} className="enable-btn">
            Enable Notifications
          </button>
          <button onClick={handleDismiss} className="dismiss-btn">
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationPrompt;
