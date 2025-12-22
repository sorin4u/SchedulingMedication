// Request notification permission
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

// Send a notification
export const sendNotification = (title, options = {}) => {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: '/vite.svg',
      badge: '/vite.svg',
      vibrate: [200, 100, 200],
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }
};

// Check if it's time to take medication
export const isTimeToTakeMedication = (medicationTime) => {
  if (!medicationTime) return false;

  const now = new Date();
  const [hours, minutes] = medicationTime.split(':');
  
  const medicationDate = new Date();
  medicationDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  const timeDiff = Math.abs(now - medicationDate);
  const minutesDiff = Math.floor(timeDiff / 1000 / 60);

  // Notify if within 5 minutes of medication time
  return minutesDiff <= 5;
};

// Schedule notifications for medications
export const scheduleMedicationReminders = (medications) => {
  medications.forEach((medication) => {
    if (medication.time && !medication.taken_today) {
      if (isTimeToTakeMedication(medication.time)) {
        sendNotification(`Time to take ${medication.name}`, {
          body: `Dosage: ${medication.dosage || 'N/A'}\n${medication.notes || ''}`,
          tag: `medication-${medication.id}`,
          requireInteraction: true,
        });
      }
    }
  });
};

// Check medications periodically
export const startMedicationReminders = (medications, interval = 60000) => {
  // Check immediately
  scheduleMedicationReminders(medications);

  // Then check every minute (or specified interval)
  const intervalId = setInterval(() => {
    scheduleMedicationReminders(medications);
  }, interval);

  return intervalId;
};
