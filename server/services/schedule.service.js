const ScrapingSchedule = require('../models/scrapingSchedule.model');
const Site = require('../models/site.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

class ScheduleService {
    constructor() {
        this.scheduledJobs = new Map();
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.isInitialized = false;
    }

    async inicializar() {
        if (this.isInitialized) return;

        try {
            console.log('Inicializando servicio de scheduling...');
            
            // Limpiar trabajos programados existentes
            this.scheduledJobs.forEach(job => clearTimeout(job.timer));
            this.scheduledJobs.clear();

            // Obtener todos los schedules activos
            const schedules = await ScrapingSchedule.find({ activo: true }).populate('sitioId');
            console.log(`Encontrados ${schedules.length} schedules activos`);

            // Programar cada schedule
            for (const schedule of schedules) {
                if (!schedule.sitioId) {
                    console.log(`Schedule ${schedule._id} sin sitio asociado, ignorando...`);
                    continue;
                }
                await this.programarScraping(schedule);
            }

            this.isInitialized = true;
            console.log('Servicio de scheduling inicializado correctamente');
        } catch (error) {
            console.error('Error al inicializar el servicio de scheduling:', error);
            throw error;
        }
    }

    async programarScraping(schedule) {
        try {
            if (!schedule.sitioId) {
                throw new Error('Schedule sin sitio asociado');
            }

            // Cancelar job existente si existe
            if (this.scheduledJobs.has(schedule._id.toString())) {
                clearTimeout(this.scheduledJobs.get(schedule._id.toString()).timer);
                this.scheduledJobs.delete(schedule._id.toString());
            }

            const ahora = new Date();
            const proximaEjecucion = schedule.calcularProximaEjecucion(ahora);
            const tiempoHastaEjecucion = proximaEjecucion.getTime() - ahora.getTime();

            if (tiempoHastaEjecucion <= 0) {
                console.log(`Schedule ${schedule._id} con tiempo negativo, recalculando...`);
                schedule.proximaEjecucion = schedule.calcularProximaEjecucion(new Date());
                await schedule.save();
                return this.programarScraping(schedule);
            }

            console.log(`Programando scraping para ${schedule.sitioId.nombre}:`, {
                proximaEjecucion: proximaEjecucion.toLocaleString(),
                tiempoRestante: Math.round(tiempoHastaEjecucion / 1000 / 60) + ' minutos'
            });

            const timer = setTimeout(async () => {
                await this.ejecutarScraping(schedule);
            }, tiempoHastaEjecucion);

            this.scheduledJobs.set(schedule._id.toString(), {
                timer,
                proximaEjecucion
            });

            // Actualizar próxima ejecución en la base de datos
            schedule.proximaEjecucion = proximaEjecucion;
            await schedule.save();

            return true;
        } catch (error) {
            console.error(`Error al programar scraping para schedule ${schedule._id}:`, error);
            return false;
        }
    }

    async ejecutarScraping(schedule) {
        console.log(`Iniciando scraping para ${schedule.sitioId.nombre}`);
        
        try {
            const resultado = await this.realizarScraping(schedule.sitioId);
            
            // Actualizar última ejecución y resetear intentos fallidos
            schedule.ultimaEjecucion = new Date();
            schedule.intentosFallidos = 0;
            schedule.ultimoError = null;

            // Registrar en historial
            await ScrapingHistory.create({
                siteId: schedule.sitioId._id,
                estado: 'exitoso',
                cantidadProyecciones: resultado.proyecciones?.length || 0,
                fechaScraping: new Date()
            });

            console.log(`Scraping exitoso para ${schedule.sitioId.nombre}`);
        } catch (error) {
            console.error(`Error en scraping para ${schedule.sitioId.nombre}:`, error);
            
            // Actualizar contador de intentos fallidos
            schedule.intentosFallidos = (schedule.intentosFallidos || 0) + 1;
            schedule.ultimoError = {
                mensaje: error.message,
                fecha: new Date()
            };

            // Registrar en historial
            await ScrapingHistory.create({
                siteId: schedule.sitioId._id,
                estado: 'fallido',
                mensajeError: error.message,
                fechaScraping: new Date()
            });
        }

        // Guardar cambios y programar siguiente ejecución
        await schedule.save();
        await this.programarScraping(schedule);
    }

    async realizarScraping(sitio) {
        // Aquí va la lógica existente de scraping
        // Por ahora es un placeholder
        return { proyecciones: [] };
    }

    async agregarSchedule(sitioId, configuracion) {
        try {
            const sitio = await Site.findById(sitioId);
            if (!sitio) {
                throw new Error('Sitio no encontrado');
            }

            // Crear nuevo schedule
            const schedule = new ScrapingSchedule({
                sitioId,
                tipoFrecuencia: configuracion.tipoFrecuencia,
                configuracion: {
                    hora: configuracion.hora,
                    diasSemana: configuracion.diasSemana,
                    diaMes: configuracion.diaMes
                },
                activo: true
            });

            await schedule.save();
            await this.programarScraping(schedule);

            return schedule;
        } catch (error) {
            console.error('Error al agregar schedule:', error);
            throw error;
        }
    }

    async pausarSchedule(scheduleId) {
        try {
            const schedule = await ScrapingSchedule.findById(scheduleId);
            if (!schedule) {
                throw new Error('Schedule no encontrado');
            }

            schedule.activo = false;
            await schedule.save();

            if (this.scheduledJobs.has(scheduleId.toString())) {
                clearTimeout(this.scheduledJobs.get(scheduleId.toString()).timer);
                this.scheduledJobs.delete(scheduleId.toString());
            }

            return schedule;
        } catch (error) {
            console.error('Error al pausar schedule:', error);
            throw error;
        }
    }

    async reanudarSchedule(scheduleId) {
        try {
            const schedule = await ScrapingSchedule.findById(scheduleId).populate('sitioId');
            if (!schedule) {
                throw new Error('Schedule no encontrado');
            }

            schedule.activo = true;
            schedule.intentosFallidos = 0;
            schedule.ultimoError = null;
            await schedule.save();

            await this.programarScraping(schedule);

            return schedule;
        } catch (error) {
            console.error('Error al reanudar schedule:', error);
            throw error;
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
            console.error('Error al obtener estado de schedules:', error);
            throw error;
        }
    }
}

module.exports = new ScheduleService();