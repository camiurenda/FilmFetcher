const ScrapingSchedule = require('../models/scrapingSchedule.model');
const Site = require('../models/site.model');

/**
 * Servicio para gestionar la programación de tareas de scraping
 * Maneja la creación, actualización y ejecución de schedules
 */
class ScheduleManagerService {
    constructor() {
        this.schedules = new Map();
        this.timers = new Map();
        this.scrapingService = null;
    }

    /**
     * Inyecta el servicio de scraping para evitar dependencia circular
     * @param {Object} service - Instancia del servicio de scraping
     */
    setScrapingService(service) {
        this.scrapingService = service;
    }

    /**
     * Calcula la próxima ejecución basada en la configuración del schedule
     * @param {Object} configuracion - Configuración del schedule
     * @returns {Date} Fecha de próxima ejecución
     */
    calcularProximaEjecucion(configuracion) {
        const ahora = new Date();
        const [hora, minuto] = configuracion.hora.split(':').map(Number);
        let proximaEjecucion = new Date();
        proximaEjecucion.setHours(hora, minuto, 0, 0);

        switch (configuracion.tipoFrecuencia) {
            case 'diaria':
                if (proximaEjecucion <= ahora) {
                    proximaEjecucion.setDate(proximaEjecucion.getDate() + 1);
                }
                break;

            case 'semanal':
                while (!configuracion.diasSemana.includes(proximaEjecucion.getDay()) || 
                       proximaEjecucion <= ahora) {
                    proximaEjecucion.setDate(proximaEjecucion.getDate() + 1);
                }
                break;

            case 'mensual-dia':
                proximaEjecucion.setDate(configuracion.diaMes);
                if (proximaEjecucion <= ahora) {
                    proximaEjecucion.setMonth(proximaEjecucion.getMonth() + 1);
                }
                break;

            case 'mensual-posicion':
                proximaEjecucion = this.calcularFechaPosicionMensual(configuracion);
                if (proximaEjecucion <= ahora) {
                    proximaEjecucion.setMonth(proximaEjecucion.getMonth() + 1);
                    proximaEjecucion = this.calcularFechaPosicionMensual(configuracion, proximaEjecucion);
                }
                break;
        }

        return proximaEjecucion;
    }

    /**
     * Calcula la fecha para schedules mensuales por posición
     * @param {Object} configuracion - Configuración del schedule
     * @param {Date} fecha - Fecha base opcional
     * @returns {Date} Fecha calculada
     */
    calcularFechaPosicionMensual(configuracion, fecha = new Date()) {
        const nuevaFecha = new Date(fecha);
        nuevaFecha.setDate(1);
        const [hora, minuto] = configuracion.hora.split(':').map(Number);
        nuevaFecha.setHours(hora, minuto, 0, 0);

        const posiciones = {
            'primera': 0,
            'segunda': 1,
            'tercera': 2,
            'cuarta': 3,
            'ultima': -1
        };

        if (configuracion.semanaMes === 'ultima') {
            nuevaFecha.setMonth(nuevaFecha.getMonth() + 1, 0);
            while (nuevaFecha.getDay() !== configuracion.diaSemana) {
                nuevaFecha.setDate(nuevaFecha.getDate() - 1);
            }
        } else {
            let semanaEncontrada = 0;
            while (semanaEncontrada <= posiciones[configuracion.semanaMes]) {
                if (nuevaFecha.getDay() === configuracion.diaSemana) {
                    if (semanaEncontrada === posiciones[configuracion.semanaMes]) break;
                    semanaEncontrada++;
                }
                nuevaFecha.setDate(nuevaFecha.getDate() + 1);
            }
        }

        return nuevaFecha;
    }

    /**
     * Inicia el timer para un schedule
     * @param {Object} schedule - Schedule a iniciar
     */
    async iniciarTimer(schedule) {
        if (!this.scrapingService) {
            throw new Error('ScrapingService no ha sido inyectado');
        }

        const proximaEjecucion = this.calcularProximaEjecucion(schedule);
        const ahora = new Date();
        const delay = proximaEjecucion.getTime() - ahora.getTime();

        const timer = setTimeout(async () => {
            try {
                const site = await Site.findById(schedule.sitioId);
                if (site && this.scrapingService) {
                    await this.scrapingService.ejecutarScrapingSitio(site);
                }
                await this.actualizarSchedule(schedule.sitioId, schedule);
            } catch (error) {
                console.error(`Error en ejecución programada para ${schedule.sitioId}:`, error);
            }
        }, delay);

        this.timers.set(schedule._id.toString(), timer);
        this.schedules.set(schedule._id.toString(), schedule);

        await ScrapingSchedule.findByIdAndUpdate(schedule._id, {
            proximaEjecucion,
            ultimaEjecucion: schedule.proximaEjecucion
        });
    }

    /**
     * Agrega un nuevo job de scraping
     * @param {Object} configuracion - Configuración del schedule
     * @returns {Promise<Object>} Schedule creado
     */
    async agregarJob(configuracion) {
        try {
            const sitioExiste = await Site.findById(configuracion.sitioId);
            if (!sitioExiste) {
                throw new Error('El sitio especificado no existe');
            }

            const proximaEjecucion = configuracion.scrapingInmediato ? 
                new Date() : 
                this.calcularProximaEjecucion(configuracion);

            const nuevoSchedule = new ScrapingSchedule({
                ...configuracion,
                proximaEjecucion,
                activo: true
            });

            const scheduleGuardado = await nuevoSchedule.save();
            await this.iniciarTimer(scheduleGuardado);

            return scheduleGuardado;
        } catch (error) {
            console.error('Error al agregar job:', error);
            throw error;
        }
    }

    /**
     * Actualiza un schedule existente
     * @param {string} sitioId - ID del sitio
     * @param {Object} configuracion - Nueva configuración
     * @returns {Promise<Object>} Schedule actualizado
     */
    async actualizarSchedule(sitioId, configuracion) {
        try {
            const site = await Site.findById(sitioId);
            if (!site) {
                throw new Error('Sitio no encontrado');
            }

            const scheduleExistente = await ScrapingSchedule.findOne({ 
                sitioId, 
                activo: true 
            });

            if (scheduleExistente) {
                const proximaEjecucion = this.calcularProximaEjecucion(configuracion);
                Object.assign(scheduleExistente, {
                    ...configuracion,
                    proximaEjecucion
                });
                const scheduleActualizado = await scheduleExistente.save();
                await this.reiniciarTimer(scheduleActualizado);
                return scheduleActualizado;
            }

            return await this.agregarJob({
                sitioId,
                ...configuracion
            });
        } catch (error) {
            console.error('Error al actualizar schedule:', error);
            throw error;
        }
    }

    /**
     * Pausa un job específico
     * @param {string} scheduleId - ID del schedule
     * @returns {Promise<Object>} Schedule pausado
     */
    async pausarJob(scheduleId) {
        try {
            const schedule = await ScrapingSchedule.findById(scheduleId);
            if (!schedule) {
                throw new Error('Schedule no encontrado');
            }

            await this.detenerSchedule(scheduleId);
            schedule.activo = false;
            await schedule.save();

            return schedule;
        } catch (error) {
            console.error('Error al pausar job:', error);
            throw error;
        }
    }

    /**
     * Reanuda un job pausado
     * @param {string} scheduleId - ID del schedule
     * @returns {Promise<Object>} Schedule reactivado
     */
    async reanudarJob(scheduleId) {
        try {
            const schedule = await ScrapingSchedule.findById(scheduleId);
            if (!schedule) {
                throw new Error('Schedule no encontrado');
            }

            schedule.activo = true;
            await schedule.save();
            await this.iniciarTimer(schedule);

            return schedule;
        } catch (error) {
            console.error('Error al reanudar job:', error);
            throw error;
        }
    }

    /**
     * Reinicia el timer para un schedule
     * @param {Object} schedule - Schedule a reiniciar
     */
    async reiniciarTimer(schedule) {
        const timerId = schedule._id.toString();
        if (this.timers.has(timerId)) {
            clearTimeout(this.timers.get(timerId));
            this.timers.delete(timerId);
        }
        await this.iniciarTimer(schedule);
    }

    /**
     * Detiene un schedule específico
     * @param {string} scheduleId - ID del schedule
     */
    async detenerSchedule(scheduleId) {
        const timerId = scheduleId.toString();
        if (this.timers.has(timerId)) {
            clearTimeout(this.timers.get(timerId));
            this.timers.delete(timerId);
            this.schedules.delete(timerId);
        }
    }

    /**
     * Obtiene el estado actual de la cola de scraping
     * @returns {Promise<Object>} Estado de la cola
     */
    async obtenerEstadoCola() {
        try {
            const schedules = await ScrapingSchedule.find({ activo: true })
                .populate('sitioId')
                .sort({ proximaEjecucion: 1 });

            const ejecutandoActualmente = false; // Se puede implementar lógica de ejecución actual
            const proximaEjecucion = schedules[0]?.proximaEjecucion || null;

            return {
                ejecutandoActualmente,
                jobsEnCola: schedules.length,
                proximaEjecucion
            };
        } catch (error) {
            console.error('Error al obtener estado de la cola:', error);
            throw error;
        }
    }

    /**
     * Actualiza la cola de scraping
     */
    async actualizarCola() {
        try {
            const schedules = await ScrapingSchedule.find({ activo: true });
            for (const schedule of schedules) {
                await this.reiniciarTimer(schedule);
            }
        } catch (error) {
            console.error('Error al actualizar cola:', error);
            throw error;
        }
    }

    /**
     * Inicializa todos los schedules activos
     */
    async inicializarSchedules() {
        try {
            const schedules = await ScrapingSchedule.find({ activo: true })
                .populate('sitioId');

            for (const schedule of schedules) {
                await this.iniciarTimer(schedule);
            }

            console.log(`${schedules.length} schedules inicializados`);
        } catch (error) {
            console.error('Error al inicializar schedules:', error);
            throw error;
        }
    }
}

module.exports = new ScheduleManagerService();