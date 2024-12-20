// FilmFetcher/server/services/schedule.service.js

const moment = require('moment-timezone');
const ScrapingSchedule = require('../models/scrapingSchedule.model');
const Site = require('../models/site.model');

class ScheduleService {
    constructor() {
        this.scheduledJobs = new Map();
        this.isInitialized = false;
        this.timezone = 'America/Argentina/Buenos_Aires';
        this.watchInterval = null;
    }

    async inicializar() {
        try {
            console.log('[Schedule] Inicializando servicio...');
            
            this.scheduledJobs.forEach(job => clearTimeout(job.timer));
            this.scheduledJobs.clear();

            const schedules = await ScrapingSchedule.find({ activo: true }).populate('sitioId');
            console.log(`[Schedule] Encontrados ${schedules.length} schedules activos`);

            for (const schedule of schedules) {
                if (!schedule.sitioId) {
                    console.log(`[Schedule] Schedule ${schedule._id} sin sitio asociado, ignorando...`);
                    continue;
                }
                await this.programarScraping(schedule);
            }

            if (!this.watchInterval) {
                this.watchInterval = setInterval(async () => {
                    await this.verificarCambiosSchedules();
                }, 60000);
            }

            this.isInitialized = true;
            console.log('[Schedule] Servicio inicializado correctamente');
        } catch (error) {
            console.error('[Schedule] Error al inicializar:', error);
            throw error;
        }
    }

    async verificarCambiosSchedules() {
        try {
            //console.log('[Schedule] Verificando cambios en schedules...');
            const schedulesActuales = await ScrapingSchedule.find({ activo: true }).populate('sitioId');
            
            for (const schedule of schedulesActuales) {
                const jobActual = this.scheduledJobs.get(schedule._id.toString());
                
                if (!jobActual) {
                   // console.log(`[Schedule] Nuevo schedule detectado: ${schedule._id}`);
                    await this.programarScraping(schedule);
                    continue;
                }

                if (this.hayCambiosEnConfiguracion(schedule, jobActual.config)) {
                 //   console.log(`[Schedule] Cambios detectados en schedule ${schedule._id}`);
                    await this.programarScraping(schedule);
                }
            }

            for (const [id, job] of this.scheduledJobs) {
                const scheduleExiste = schedulesActuales.find(s => s._id.toString() === id);
                if (!scheduleExiste) {
                //    console.log(`[Schedule] Eliminando schedule inactivo: ${id}`);
                    clearTimeout(job.timer);
                    this.scheduledJobs.delete(id);
                }
            }
        } catch (error) {
           console.error('[Schedule] Error al verificar cambios:', error);
        }
    }

    hayCambiosEnConfiguracion(scheduleNuevo, configAnterior) {
        if (!configAnterior) return true;

        const cambios = 
            scheduleNuevo.tipoFrecuencia !== configAnterior.tipoFrecuencia ||
            JSON.stringify(scheduleNuevo.configuraciones) !== JSON.stringify(configAnterior.configuraciones) ||
            scheduleNuevo.activo !== configAnterior.activo;

        return cambios;
    }

    async programarScraping(schedule) {
        try {
           //console.log(`[Schedule] Programando scraping para sitio ${schedule.sitioId?.nombre || schedule._id}`);
            
            if (!schedule.sitioId) {
                throw new Error('Schedule sin sitio asociado');
            }

            if (this.scheduledJobs.has(schedule._id.toString())) {
                clearTimeout(this.scheduledJobs.get(schedule._id.toString()).timer);
                this.scheduledJobs.delete(schedule._id.toString());
               //console.log(`[Schedule] Job anterior cancelado para ${schedule._id}`);
            }

            const ahora = new Date();
            const proximaEjecucion = await this.calcularProximaEjecucion(schedule, ahora);
            
            if (!proximaEjecucion) {
              //console.log(`[Schedule] No se pudo calcular próxima ejecución para ${schedule._id}`);
                return false;
            }

            const tiempoHastaEjecucion = proximaEjecucion.getTime() - ahora.getTime();
            
            //console.log(`[Schedule] Nueva programación:`, {
            //    sitio: schedule.sitioId.nombre,
            //    ahora: ahora.toLocaleString(),
            //    proximaEjecucion: proximaEjecucion.toLocaleString(),
            //    tiempoHastaEjecucion: Math.round(tiempoHastaEjecucion / 1000 / 60) + ' minutos'
            //});

            if (tiempoHastaEjecucion <= 1) {
                //console.log(`[Schedule] Tiempo negativo para ${schedule._id}, ejecutando inmediatamente...`);
                await this.ejecutarScraping(schedule);
                schedule.proximaEjecucion = await this.calcularProximaEjecucion(schedule, new Date());
                await schedule.save();
                return this.programarScraping(schedule);
            }

            const timer = setTimeout(async () => {
                try {
                    //console.log(`[Schedule] ⏰ Ejecutando scraping programado para ${schedule.sitioId.nombre}`);
                    await this.ejecutarScraping(schedule);
                    
                    await this.programarScraping(schedule);
                } catch (error) {
                    //console.error(`[Schedule] Error en ejecución de ${schedule.sitioId.nombre}:`, error);
                    
                    schedule.intentosFallidos = (schedule.intentosFallidos || 0) + 1;
                    schedule.ultimoError = {
                        mensaje: error.message,
                        fecha: new Date(),
                        intentos: schedule.intentosFallidos
                    };
                    await schedule.save();

                    setTimeout(() => this.programarScraping(schedule), 5 * 60 * 1000);
                }
            }, tiempoHastaEjecucion);

            this.scheduledJobs.set(schedule._id.toString(), {
                timer,
                proximaEjecucion,
                sitioId: schedule.sitioId._id,
                config: {
                    tipoFrecuencia: schedule.tipoFrecuencia,
                    configuraciones: JSON.parse(JSON.stringify(schedule.configuraciones)),
                    activo: schedule.activo
                }
            });

            schedule.proximaEjecucion = proximaEjecucion;
            await schedule.save();

            return true;
        } catch (error) {
            console.error(`[Schedule] Error al programar scraping para ${schedule._id}:`, error);
            return false;
        }
    }

    async ejecutarScraping(schedule) {
        try {
            console.log(`[Schedule] Iniciando scraping para ${schedule.sitioId.nombre}`);
            
            const ScrapingService = require('./scraping.service');
            const resultado = await ScrapingService.scrapeSite(schedule.sitioId);
            
            schedule.ultimaEjecucion = new Date();
            schedule.intentosFallidos = 0;
            schedule.ultimoError = null;
            await schedule.save();

            console.log(`[Schedule] Scraping completado para ${schedule.sitioId.nombre}`);
            return resultado;
        } catch (error) {
            console.error(`[Schedule] Error en scraping:`, error);
            throw error;
        }
    }

    async calcularProximaEjecucion(schedule, desde = new Date()) {
        try {
            if (!schedule.sitioId) {
                throw new Error('Schedule sin sitio asociado');
            }

            const ahora = moment(desde).tz(this.timezone);
            let proximaEjecucionGlobal = null;

            if (schedule.configuraciones && schedule.configuraciones.length > 0) {
                for (const config of schedule.configuraciones) {
                    const [horas, minutos] = config.hora.split(':');
                    let fecha = moment(ahora)
                        .tz(this.timezone)
                        .hours(parseInt(horas))
                        .minutes(parseInt(minutos))
                        .seconds(0)
                        .milliseconds(0);

                    if (fecha.isSameOrBefore(ahora)) {
                        fecha.add(1, 'day');
                    }

                    let fechasCandidatas = [];

                    switch (schedule.tipoFrecuencia) {
                        case 'semanal': {
                            if (config.diasSemana && config.diasSemana.length > 0) {
                                let encontrado = false;
                                let intentos = 0;
                                while (!encontrado && intentos < 7) {
                                    if (config.diasSemana.includes(fecha.day())) {
                                        fechasCandidatas.push(fecha.clone());
                                        encontrado = true;
                                    }
                                    fecha.add(1, 'day');
                                    intentos++;
                                }
                            }
                            break;
                        }

                        case 'mensual': {
                            if (config.diasMes && config.diasMes.length > 0) {
                                const diasOrdenados = [...config.diasMes].sort((a, b) => a - b);
                                
                                // Verificar días en el mes actual
                                for (const dia of diasOrdenados) {
                                    const fechaPrueba = fecha.clone().date(dia);
                                    if (fechaPrueba.isAfter(ahora)) {
                                        fechasCandidatas.push(fechaPrueba);
                                    }
                                }
                                
                                // Si no hay fechas válidas en el mes actual, verificar el próximo mes
                                if (fechasCandidatas.length === 0) {
                                    const fechaProximoMes = fecha.clone().add(1, 'month').startOf('month');
                                    for (const dia of diasOrdenados) {
                                        fechasCandidatas.push(fechaProximoMes.clone().date(dia));
                                    }
                                }
                            }
                            break;
                        }

                        case 'test': {
                            fechasCandidatas.push(moment(ahora).add(1, 'minute'));
                            break;
                        }

                        default: {
                            fechasCandidatas.push(fecha);
                            break;
                        }
                    }

                    // Encontrar la fecha más cercana entre las candidatas
                    for (const fechaCandidata of fechasCandidatas) {
                        if (!proximaEjecucionGlobal || fechaCandidata.isBefore(proximaEjecucionGlobal)) {
                            proximaEjecucionGlobal = fechaCandidata;
                        }
                    }
                }
            }

            return proximaEjecucionGlobal?.toDate();
        } catch (error) {
            console.error('[Schedule] Error calculando próxima ejecución:', error);
            return null;
        }
    }

    async obtenerEstadoSchedules() {
        try {
            const schedules = await ScrapingSchedule.find()
                .populate('sitioId')
                .sort({ proximaEjecucion: 1 });

            return schedules.map(schedule => ({
                id: schedule._id,
                sitio: schedule.sitioId?.nombre || 'Desconocido',
                proximaEjecucion: schedule.proximaEjecucion,
                ultimaEjecucion: schedule.ultimaEjecucion,
                estado: schedule.activo ? 'activo' : 'pausado',
                tipoFrecuencia: schedule.tipoFrecuencia,
                intentosFallidos: schedule.intentosFallidos,
                ultimoError: schedule.ultimoError
            }));
        } catch (error) {
            console.error('[Schedule] Error al obtener estado:', error);
            throw error;
        }
    }
}

module.exports = new ScheduleService();
