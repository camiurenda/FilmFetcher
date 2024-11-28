const ScrapingSchedule = require('../models/scrapingSchedule.model');
const Site = require('../models/site.model');
const axios = require('axios');
require('dotenv').config();

const SCRAPING_SERVICE_URL = process.env.SCRAPING_SERVICE_URL || 'http://localhost:4000';

class ScheduleManagerService {
    constructor() {
        this.verificarConexion();
    }

    async verificarConexion() {
        try {
            await axios.get(`${SCRAPING_SERVICE_URL}/api/health`);
            console.log('Conexión exitosa con el servicio de scheduling');
        } catch (error) {
            console.error('Error al conectar con el servicio de scheduling:', error.message);
        }
    }

    async agregarJob(configuracion) {
        try {
            console.log('ScheduleManagerService: Agregando nuevo job con configuración:', configuracion);

            // Validar sitio
            const sitio = await Site.findById(configuracion.sitioId);
            if (!sitio) {
                throw new Error('El sitio especificado no existe');
            }

            // Crear schedule en base de datos local
            const schedule = new ScrapingSchedule({
                sitioId: configuracion.sitioId,
                tipoFrecuencia: configuracion.tipoFrecuencia,
                configuraciones: configuracion.configuraciones,
                tags: configuracion.tags || [],
                activo: true,
                scrapingInmediato: configuracion.scrapingInmediato || false,
                fechaInicio: configuracion.fechaInicio,
                fechaFin: configuracion.fechaFin
            });

            const scheduleGuardado = await schedule.save();
            console.log('Schedule guardado en BD:', scheduleGuardado._id);

            // Calcular próxima ejecución
            const proximaEjecucion = scheduleGuardado.calcularProximaEjecucion();
            if (!proximaEjecucion) {
                throw new Error('No se pudo calcular la próxima ejecución');
            }

            // Registrar en el microservicio
            const scheduleConfig = {
                id: scheduleGuardado._id.toString(),
                proximaEjecucion: proximaEjecucion,
                url: sitio.url,
                configuracion: {
                    tipoFrecuencia: configuracion.tipoFrecuencia,
                    configuraciones: configuracion.configuraciones,
                    scrapingInmediato: configuracion.scrapingInmediato
                }
            };

            const response = await axios.post(`${SCRAPING_SERVICE_URL}/api/schedule`, scheduleConfig);
            console.log('Schedule registrado en microservicio:', response.data);

            return scheduleGuardado;
        } catch (error) {
            console.error('Error al agregar job:', error);
            throw new Error(`Error al agregar job: ${error.message}`);
        }
    }

    async actualizarSchedule(scheduleId, configuracion) {
        try {
            console.log(`Actualizando schedule ${scheduleId}:`, configuracion);

            const scheduleExistente = await ScrapingSchedule.findById(scheduleId);
            if (!scheduleExistente) {
                throw new Error('Schedule no encontrado');
            }

            const sitio = await Site.findById(scheduleExistente.sitioId);
            if (!sitio) {
                throw new Error('Sitio no encontrado');
            }

            // Actualizar en base de datos local
            Object.assign(scheduleExistente, configuracion);
            const scheduleActualizado = await scheduleExistente.save();

            // Actualizar en microservicio
            if (scheduleActualizado.activo) {
                // Primero cancelar el schedule existente
                await axios.delete(`${SCRAPING_SERVICE_URL}/api/schedule/${scheduleId}`);

                // Crear nuevo schedule con la configuración actualizada
                const scheduleConfig = {
                    id: scheduleId,
                    proximaEjecucion: scheduleActualizado.calcularProximaEjecucion(),
                    url: sitio.url,
                    configuracion: {
                        tipoFrecuencia: configuracion.tipoFrecuencia,
                        configuraciones: configuracion.configuraciones
                    }
                };

                await axios.post(`${SCRAPING_SERVICE_URL}/api/schedule`, scheduleConfig);
            }

            return scheduleActualizado;
        } catch (error) {
            console.error('Error al actualizar schedule:', error);
            throw new Error(`Error al actualizar schedule: ${error.message}`);
        }
    }

    async pausarJob(scheduleId) {
        try {
            console.log(`Pausando job ${scheduleId}`);
            
            const schedule = await ScrapingSchedule.findById(scheduleId);
            if (!schedule) {
                throw new Error('Schedule no encontrado');
            }

            // Cancelar en microservicio
            await axios.delete(`${SCRAPING_SERVICE_URL}/api/schedule/${scheduleId}`);

            // Actualizar estado local
            schedule.activo = false;
            await schedule.save();

            return schedule;
        } catch (error) {
            console.error('Error al pausar job:', error);
            throw new Error(`Error al pausar job: ${error.message}`);
        }
    }

    async reanudarJob(scheduleId) {
        try {
            console.log(`Reanudando job ${scheduleId}`);
            
            const schedule = await ScrapingSchedule.findById(scheduleId);
            if (!schedule) {
                throw new Error('Schedule no encontrado');
            }

            const sitio = await Site.findById(schedule.sitioId);
            if (!sitio) {
                throw new Error('Sitio no encontrado');
            }

            // Actualizar estado local
            schedule.activo = true;
            schedule.bloqueo = {
                bloqueado: false,
                fechaBloqueo: null,
                razon: null
            };
            schedule.ultimoError = {
                intentos: 0
            };

            await schedule.save();

            // Registrar en microservicio
            const scheduleConfig = {
                id: scheduleId,
                proximaEjecucion: schedule.calcularProximaEjecucion(),
                url: sitio.url,
                configuracion: {
                    tipoFrecuencia: schedule.tipoFrecuencia,
                    configuraciones: schedule.configuraciones
                }
            };

            await axios.post(`${SCRAPING_SERVICE_URL}/api/schedule`, scheduleConfig);

            return schedule;
        } catch (error) {
            console.error('Error al reanudar job:', error);
            throw new Error(`Error al reanudar job: ${error.message}`);
        }
    }

    async obtenerEstadoCola() {
        try {
            // Obtener schedules locales
            const schedules = await ScrapingSchedule.find({ activo: true })
                .populate('sitioId')
                .sort({ proximaEjecucion: 1 });

            // Obtener estado del microservicio
            const microserviceStatus = await axios.get(`${SCRAPING_SERVICE_URL}/api/schedules`);
            
            const jobsEnEjecucion = microserviceStatus.data
                .filter(job => job.status === 'ejecutando')
                .map(job => ({
                    id: job.id,
                    inicio: job.lastRun
                }));

            return {
                jobsEnCola: schedules.length,
                jobsEnEjecucion,
                schedules: schedules,
                proximaEjecucion: schedules[0]?.proximaEjecucion || null
            };
        } catch (error) {
            console.error('Error al obtener estado de la cola:', error);
            throw new Error(`Error al obtener estado de la cola: ${error.message}`);
        }
    }

    async inicializarSchedules() {
        try {
            console.log('Iniciando inicialización de schedules...');
            
            const schedules = await ScrapingSchedule.find({ activo: true })
                .populate('sitioId')
                .sort({ proximaEjecucion: 1 });

            console.log(`Encontrados ${schedules.length} schedules activos`);

            // Cancelar todos los schedules existentes en el microservicio
            await axios.get(`${SCRAPING_SERVICE_URL}/api/schedules`).then(async response => {
                for (const job of response.data) {
                    await axios.delete(`${SCRAPING_SERVICE_URL}/api/schedule/${job.id}`);
                }
            });

            // Registrar schedules actualizados
            for (const schedule of schedules) {
                try {
                    if (!schedule.sitioId) {
                        console.warn(`Schedule ${schedule._id} sin sitio asociado`);
                        continue;
                    }

                    const scheduleConfig = {
                        id: schedule._id.toString(),
                        proximaEjecucion: schedule.calcularProximaEjecucion(),
                        url: schedule.sitioId.url,
                        configuracion: {
                            tipoFrecuencia: schedule.tipoFrecuencia,
                            configuraciones: schedule.configuraciones
                        }
                    };

                    await axios.post(`${SCRAPING_SERVICE_URL}/api/schedule`, scheduleConfig);
                    console.log(`Schedule inicializado para sitio: ${schedule.sitioId.nombre}`);
                } catch (error) {
                    console.error(`Error al inicializar schedule ${schedule._id}:`, error);
                }
            }

            console.log('Inicialización de schedules completada');
        } catch (error) {
            console.error('Error al inicializar schedules:', error);
            throw new Error(`Error al inicializar schedules: ${error.message}`);
        }
    }
}

module.exports = new ScheduleManagerService();