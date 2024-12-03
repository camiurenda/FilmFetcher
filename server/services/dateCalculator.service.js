const moment = require('moment-timezone');

class DateCalculatorService {
    constructor() {
        this.timezone = 'America/Argentina/Buenos_Aires';
    }

    calcularProximaEjecucion(tipoFrecuencia, configuracion, desde = new Date()) {
        console.log(`[DateCalculator] Calculando próxima ejecución:`, {
            tipoFrecuencia,
            configuracion,
            desde: desde.toISOString()
        });

        try {
            const ahora = moment(desde).tz(this.timezone);
            const [horas, minutos] = configuracion.hora.split(':').map(Number);

            // Crear fecha base con la hora especificada
            let proximaEjecucion = moment(ahora).tz(this.timezone)
                .hour(horas)
                .minute(minutos)
                .second(0)
                .millisecond(0);

            // Si la hora ya pasó hoy, empezar desde mañana
            if (proximaEjecucion.isSameOrBefore(ahora)) {
                proximaEjecucion.add(1, 'day');
            }

            switch (tipoFrecuencia) {
                case 'diaria':
                    // Ya está calculada correctamente
                    break;

                case 'semanal':
                    if (!configuracion.diasSemana?.length) {
                        throw new Error('Configuración semanal requiere días de la semana');
                    }

                    let diasOrdenados = [...configuracion.diasSemana].sort((a, b) => a - b);
                    let diaEncontrado = false;
                    let intentos = 0;
                    const diaActual = proximaEjecucion.day();

                    // Encontrar el próximo día válido
                    while (!diaEncontrado && intentos < 7) {
                        if (diasOrdenados.includes(proximaEjecucion.day())) {
                            diaEncontrado = true;
                        } else {
                            proximaEjecucion.add(1, 'day');
                        }
                        intentos++;
                    }

                    if (!diaEncontrado) {
                        proximaEjecucion = null;
                    }
                    break;

                case 'mensual-dia':
                    if (!configuracion.diasMes?.length) {
                        throw new Error('Configuración mensual requiere días del mes');
                    }

                    let diasMesOrdenados = [...configuracion.diasMes].sort((a, b) => a - b);
                    let diaValido = diasMesOrdenados.find(dia => 
                        moment(proximaEjecucion).date(dia).isValid() &&
                        moment(proximaEjecucion).date(dia).isAfter(ahora)
                    );

                    if (!diaValido) {
                        proximaEjecucion.add(1, 'month').date(diasMesOrdenados[0]);
                    } else {
                        proximaEjecucion.date(diaValido);
                    }
                    break;

                case 'test':
                    proximaEjecucion = moment(ahora).add(1, 'minute');
                    break;

                default:
                    throw new Error(`Tipo de frecuencia no soportado: ${tipoFrecuencia}`);
            }

            console.log(`[DateCalculator] Próxima ejecución calculada:`, {
                resultado: proximaEjecucion ? proximaEjecucion.format() : null
            });

            return proximaEjecucion ? proximaEjecucion.toDate() : null;

        } catch (error) {
            console.error(`[DateCalculator] Error calculando próxima ejecución:`, error);
            throw error;
        }
    }
}

module.exports = new DateCalculatorService();