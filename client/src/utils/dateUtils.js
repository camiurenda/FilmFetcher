// FilmFetcher/client/src/utils/dateUtils.js

import API_URL from '../config/api.js';
import moment from 'moment-timezone';

const isProduction = !API_URL.includes('localhost');
const TIMEZONE = 'America/Argentina/Buenos_Aires';

// Ajusta la zona horaria de las fechas que vienen del backend
export const adjustTimeZone = (date) => {
    if (!date) return null;
    
    const momentDate = moment(date).tz(TIMEZONE);
    
    // En producción sumamos 3 horas para compensar que vienen 3 horas atrasadas
    if (isProduction) {
        momentDate.add(3, 'hours');
    }
    
    return momentDate.toDate();
};

// Función para formatear fecha y hora
export const formatDateTime = (date) => {
    if (!date) return '';
    const adjustedDate = adjustTimeZone(date);
    return moment(adjustedDate).format('DD/MM/YYYY HH:mm');
};

// Función para formatear solo fecha
export const formatDate = (date) => {
    if (!date) return '';
    const adjustedDate = adjustTimeZone(date);
    return moment(adjustedDate).format('DD/MM/YYYY');
};

// Función para obtener la hora formateada
export const formatTime = (date) => {
    if (!date) return '';
    const adjustedDate = adjustTimeZone(date);
    return moment(adjustedDate).format('HH:mm');
};

// Función para verificar si una fecha es futura
export const isFutureDate = (date) => {
    if (!date) return false;
    const adjustedDate = adjustTimeZone(date);
    return moment(adjustedDate).isAfter(moment());
};

// Función para obtener la diferencia relativa (ej: "en 2 días")
export const getRelativeTime = (date) => {
    if (!date) return '';
    const adjustedDate = adjustTimeZone(date);
    return moment(adjustedDate).fromNow();
};