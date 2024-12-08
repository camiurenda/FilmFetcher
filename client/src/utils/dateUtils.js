import API_URL from '../config/api.js';

const isProduction = !API_URL.includes('localhost');

// Función para ajustar la zona horaria de las fechas que vienen del backend
export const adjustTimeZone = (date) => {
    if (!date) return null;
    const dateObj = new Date(date);
    
    // Solo ajustamos la hora si estamos en producción
    if (isProduction) {
        dateObj.setHours(dateObj.getHours() - 3);
    }
    return dateObj;
};

// Función para formatear fecha y hora
export const formatDateTime = (date) => {
    if (!date) return '';
    const adjustedDate = adjustTimeZone(date);
    return adjustedDate.toLocaleString();
};

// Función para formatear solo fecha
export const formatDate = (date) => {
    if (!date) return '';
    const adjustedDate = adjustTimeZone(date);
    return adjustedDate.toLocaleDateString();
};
