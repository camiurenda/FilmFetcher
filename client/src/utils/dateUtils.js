// FilmFetcher/client/src/utils/dateUtils.js

import API_URL from '../config/api.js';
import moment from 'moment-timezone';

const isProduction = !API_URL.includes('localhost');
const TIMEZONE = 'America/Argentina/Buenos_Aires';

// Ajusta la zona horaria de las fechas que vienen del backend
export const adjustTimeZone = (date) => {
    if (!date) return null;
    
    console.log('🕒 [DateUtils] Procesando fecha:', {
        fechaOriginal: date,
        fechaOriginalISO: new Date(date).toISOString(),
        ambiente: isProduction ? 'producción' : 'desarrollo'
    });
    
    const momentDate = moment(date).tz(TIMEZONE);
    console.log('🕒 [DateUtils] Después de aplicar timezone:', {
        fechaMoment: momentDate.format(),
        timezone: TIMEZONE
    });
    
    if (isProduction) {
        momentDate.add(3, 'hours');
        console.log('🕒 [DateUtils] Después de ajuste en producción:', {
            fechaAjustada: momentDate.format(),
            diferencia: '+3 horas'
        });
    }
    
    const fechaFinal = momentDate.toDate();
    console.log('🕒 [DateUtils] Fecha final:', {
        fechaFinal: fechaFinal,
        fechaFinalISO: fechaFinal.toISOString(),
        fechaFinalLocal: fechaFinal.toLocaleString('es-AR', { timeZone: TIMEZONE })
    });
    
    return fechaFinal;
};

// Función para formatear fecha y hora
export const formatDateTime = (date) => {
    if (!date) return '';
    console.log('📅 [DateUtils] Formateando fecha y hora:', date);
    const adjustedDate = adjustTimeZone(date);
    const formatted = moment(adjustedDate).format('DD/MM/YYYY HH:mm');
    console.log('📅 [DateUtils] Fecha formateada:', formatted);
    return formatted;
};

// Función para formatear solo fecha
export const formatDate = (date) => {
    if (!date) return '';
    console.log('📅 [DateUtils] Formateando solo fecha:', date);
    const adjustedDate = adjustTimeZone(date);
    const formatted = moment(adjustedDate).format('DD/MM/YYYY');
    console.log('📅 [DateUtils] Fecha formateada:', formatted);
    return formatted;
};

// Función para obtener la hora formateada
export const formatTime = (date) => {
    if (!date) return '';
    console.log('🕐 [DateUtils] Formateando hora:', date);
    const adjustedDate = adjustTimeZone(date);
    const formatted = moment(adjustedDate).format('HH:mm');
    console.log('🕐 [DateUtils] Hora formateada:', formatted);
    return formatted;
};

// Función para verificar si una fecha es futura
export const isFutureDate = (date) => {
    if (!date) return false;
    const adjustedDate = adjustTimeZone(date);
    const isFuture = moment(adjustedDate).isAfter(moment());
    console.log('🔮 [DateUtils] Verificando fecha futura:', {
        fecha: date,
        ajustada: adjustedDate,
        esFutura: isFuture
    });
    return isFuture;
};

// Función para obtener la diferencia relativa
export const getRelativeTime = (date) => {
    if (!date) return '';
    console.log('⏳ [DateUtils] Calculando tiempo relativo:', date);
    const adjustedDate = adjustTimeZone(date);
    const relative = moment(adjustedDate).fromNow();
    console.log('⏳ [DateUtils] Tiempo relativo:', relative);
    return relative;
};