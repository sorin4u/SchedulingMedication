// API Configuration
// In production (on Render), this will use the deployed backend URL
// In development, this will use localhost:3000

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default API_URL;
