/* eslint-env node */
/* global process */
// Quick test to verify email configuration
import 'dotenv/config';
import { sendMedicationReminder } from './src/utils/emailService.js';

const testMedication = {
  name: 'Test Aspirin',
  dosage: '500mg',
  frequency: 'Every 6 hours',
  notes: 'This is a test notification'
};

const testEmail = process.env.EMAIL_USER; // Send to yourself

console.log('Testing email with config:');
console.log('Host:', process.env.EMAIL_HOST);
console.log('Port:', process.env.EMAIL_PORT);
console.log('User:', process.env.EMAIL_USER);
console.log('Password set:', !!process.env.EMAIL_PASSWORD);
console.log('Sending to:', testEmail);
console.log('\nSending test email...\n');

sendMedicationReminder(testEmail, testMedication)
  .then(result => {
    console.log('\n✅ Result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
