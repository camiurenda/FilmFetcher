// config/api.js

// Añadimos un console.log para depuración
console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Otro console.log para ver el valor final de API_URL
console.log('API_URL utilizado:', API_URL);

export default API_URL;