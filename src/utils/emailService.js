/* eslint-env node */
/* global process */
import pkg from 'nodemailer';
const { createTransport } = pkg;

// Note: 'process' is a Node.js global object that provides access to environment variables
// process.env contains all environment variables from the .env file

// Create transporter for sending emails
const createTransporter = () => {
  return createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3'
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
};

/**
 * Send medication reminder email
 * @param {string} userEmail - Recipient email address
 * @param {object} medication - Medication details
 */
export const sendMedicationReminder = async (userEmail, medication) => {
  try {
    // Skip if email not configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('⚠️ Email not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env file');
      console.error('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
      console.error('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET');
      return { success: false, message: 'Email not configured' };
    }

    console.log('📧 Sending email to:', userEmail);
    console.log('📧 Email config:', {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      user: process.env.EMAIL_USER,
      hasPassword: !!process.env.EMAIL_PASSWORD
    });

    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: userEmail,
      subject: `💊 Medication Reminder: ${medication.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">💊 Medication Reminder</h2>
          <p>This is a reminder to take your medication:</p>
            <div style="background: #f7f9fc; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p style="color: #667eea; font-size: 16px; margin-bottom: 10px;">
              <strong>🕐 Time:</strong> ${new Date().toLocaleString()}
            </p>
            <h3 style="margin-top: 0; color: #333;">${medication.name}</h3>
            ${medication.dosage ? `<p><strong>Dosage:</strong> ${medication.dosage}</p>` : ''}
            ${medication.frequency ? `<p><strong>Frequency:</strong> ${medication.frequency}</p>` : ''}
            ${medication.quantity_left !== null && medication.quantity_left !== undefined ? `<p><strong>Pills Left:</strong> <span style="color: ${medication.quantity_left <= 5 ? '#e74c3c' : medication.quantity_left <= 10 ? '#f39c12' : '#27ae60'}; font-weight: bold;">${medication.quantity_left}</span>${medication.quantity_left <= 5 ? ' ⚠️ <em style="color: #e74c3c;">Running low!</em>' : ''}</p>` : ''}
            ${medication.notes ? `<p><strong>Notes:</strong> ${medication.notes}</p>` : ''}
            </div>
          
          
          ${medication.quantity_left !== null && medication.quantity_left <= 5 ? `
          <div style="background: #fff3cd; border-left: 4px solid #f39c12; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Low Stock Alert:</strong> You have only ${medication.quantity_left} pill${medication.quantity_left !== 1 ? 's' : ''} left. Please refill your prescription soon.
            </p>
          </div>
          ` : ''}
          
          <p style="color: #666; font-size: 14px;">
            Please take your medication as prescribed. If you have any questions, 
            consult your healthcare provider.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #999; font-size: 12px;">
            This is an automated reminder from your Medication Schedule App.
          </p>
        </div>
      `,
      text: `
Medication Reminder

It's time to take your medication:

Medication: ${medication.name}
${medication.dosage ? `Dosage: ${medication.dosage}` : ''}
${medication.frequency ? `Frequency: ${medication.frequency}` : ''}
${medication.quantity_left !== null && medication.quantity_left !== undefined ? `Pills Left: ${medication.quantity_left}${medication.quantity_left <= 5 ? ' ⚠️ RUNNING LOW!' : ''}` : ''}
${medication.notes ? `Notes: ${medication.notes}` : ''}

${medication.quantity_left !== null && medication.quantity_left <= 5 ? `\n⚠️ LOW STOCK ALERT: You have only ${medication.quantity_left} pill${medication.quantity_left !== 1 ? 's' : ''} left. Please refill your prescription soon.\n` : ''}
Please take your medication as prescribed.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Calculate next dose times based on frequency
 * @param {Date} startDateTime - When medication was started
 * @param {string} frequency - Frequency pattern
 * @returns {Date[]} Array of next dose times
 */
export const calculateNextDoses = (startDateTime, frequency) => {
  const doses = [];
  const start = new Date(startDateTime);
  const now = new Date();
  
  // Extract hours from frequency
  let intervalHours = 24; // Default to once daily
  
  if (frequency.includes('5 minute') || frequency.includes('5m')) {
    intervalHours = 5 / 60; // 5 minutes in hours
  } else if (frequency.includes('1 hour') || frequency.includes('1h')) {
    intervalHours = 1;
  } else if (frequency.includes('2 hours') || frequency.includes('2h')) {
    intervalHours = 2;
  } else if (frequency.includes('4 hours') || frequency.includes('4h')) {
    intervalHours = 4;
  } else if (frequency.includes('6 hours') || frequency.includes('6h')) {
    intervalHours = 6;
  } else if (frequency.includes('8 hours') || frequency.includes('8h')) {
    intervalHours = 8;
  } else if (frequency.includes('12 hours') || frequency.includes('12h')) {
    intervalHours = 12;
  } else if (frequency.includes('Twice daily')) {
    intervalHours = 12;
  } else if (frequency.includes('Three times daily')) {
    intervalHours = 8;
  } else if (frequency.includes('Four times daily')) {
    intervalHours = 6;
  }

  // Calculate next 5 doses starting from the start time
  let currentDose = new Date(start);
  
  // Fast-forward to the first dose after now
  while (currentDose < now) {
    currentDose = new Date(currentDose.getTime() + intervalHours * 60 * 60 * 1000);
  }
  
  // Get next 5 doses
  for (let i = 0; i < 5; i++) {
    doses.push(new Date(currentDose));
    currentDose = new Date(currentDose.getTime() + intervalHours * 60 * 60 * 1000);
  }
  
  return doses;
};

/**
 * Get interval in milliseconds from frequency string
 */
export const getIntervalMs = (frequency) => {
  if (frequency.includes('5 minute') || frequency.includes('5m')) {
    return 5 * 60 * 1000; // 5 minutes
  } else if (frequency.includes('1 hour') || frequency.includes('1h')) {
    return 1 * 60 * 60 * 1000;
  } else if (frequency.includes('2 hours') || frequency.includes('2h')) {
    return 2 * 60 * 60 * 1000;
  } else if (frequency.includes('4 hours') || frequency.includes('4h')) {
    return 4 * 60 * 60 * 1000;
  } else if (frequency.includes('6 hours') || frequency.includes('6h')) {
    return 6 * 60 * 60 * 1000;
  } else if (frequency.includes('8 hours') || frequency.includes('8h')) {
    return 8 * 60 * 60 * 1000;
  } else if (frequency.includes('12 hours') || frequency.includes('12h')) {
    return 12 * 60 * 60 * 1000;
  } else if (frequency.includes('Twice daily')) {
    return 12 * 60 * 60 * 1000;
  } else if (frequency.includes('Three times daily')) {
    return 8 * 60 * 60 * 1000;
  } else if (frequency.includes('Four times daily')) {
    return 6 * 60 * 60 * 1000;
  }
  return 24 * 60 * 60 * 1000; // Default: once daily
};
