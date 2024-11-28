const ScrapingSchedule = require('../models/scrapingSchedule.model');
const ScrapingService = require('./scraping.service');
const Site = require('../models/site.model');

class ScheduleManagerService {
  constructor() {
    this.schedules = new Map();
    this.timers = new Map();
    this.executingJobs = new Set();
  }

  async agregarJob(configuracion) {
    try {
      console.log('ScheduleManagerService: Agregando nuevo job con configuración:', configuracion);

      if (!configuracion.tipoFrecuencia) {
        throw new Error('El tipo de frecuencia es requerido');
      }

      const sitioExiste = await Site.findById(configuracion.sitioId);
      if (!sitioExiste) {
        throw new Error('El sitio especificado no existe');
      }

      // Validar las configuraciones
      if (!configuracion.configuraciones || !Array.isArray(configuracion.configuraciones)) {
        throw new Error('Las configuraciones son requeridas y deben ser un array');
      }

      const schedule = new ScrapingSchedule({
        sitioId: configuracion.sitioId,
        tipoFrecuencia: configuracion.tipoFrecuencia,
        configuraciones: configuracion.configuraciones,
        prioridad: configuracion.prioridad || 1,
        tags: configuracion.tags || [],
        activo: true,
        scrapingInmediato: configuracion.scrapingInmediato || false,
        fechaInicio: configuracion.fechaInicio,
        fechaFin: configuracion.fechaFin
      });

      try {
        await schedule.validate();
      } catch (validationError) {
        console.error('Error de validación:', validationError);
        throw new Error('Datos de schedule inválidos: ' + validationError.message);
      }

      const scheduleGuardado = await schedule.save();
      console.log('Schedule guardado:', scheduleGuardado._id);
      
      await this.iniciarTimer(scheduleGuardado);
      return scheduleGuardado;

    } catch (error) {
      console.error('Error al agregar job:', error);
      throw error;
    }
  }

  async iniciarTimer(schedule) {
    console.log(`Iniciando timer para schedule ${schedule._id}`);
    
    if (this.timers.has(schedule._id.toString())) {
      clearTimeout(this.timers.get(schedule._id.toString()));
    }

    // Obtener el schedule actualizado para asegurar que tenemos la última proximaEjecucion
    const scheduleActualizado = await ScrapingSchedule.findById(schedule._id);
    if (!scheduleActualizado || !scheduleActualizado.activo) {
      console.log(`Schedule ${schedule._id} inactivo o no encontrado`);
      return;
    }

    const ahora = new Date();
    const delay = scheduleActualizado.proximaEjecucion.getTime() - ahora.getTime();

    if (delay <= 0) {
      console.log(`Ejecución inmediata para ${schedule.sitioId}`);
      this.ejecutarSchedule(scheduleActualizado).catch(error => {
        console.error(`Error en ejecución inmediata:`, error);
        this.manejarError(scheduleActualizado, error);
      });
      return;
    }

    console.log(`Programando próxima ejecución para ${schedule.sitioId} en ${delay}ms (${scheduleActualizado.proximaEjecucion})`);

    const timer = setTimeout(async () => {
      try {
        await this.ejecutarSchedule(scheduleActualizado);
        await this.reprogramarSchedule(scheduleActualizado);
      } catch (error) {
        console.error(`Error en ejecución programada:`, error);
        await this.manejarError(scheduleActualizado, error);
      }
    }, delay);

    this.timers.set(schedule._id.toString(), timer);
    this.schedules.set(schedule._id.toString(), scheduleActualizado);
  }

  async ejecutarSchedule(schedule) {
    const sitioId = schedule._id.toString();
    
    if (this.executingJobs.has(sitioId)) {
      console.log(`Sitio ${sitioId} ya está siendo scrapeado. Reprogramando...`);
      await this.bloquearSchedule(schedule, 'Ejecución simultánea detectada');
      return;
    }

    try {
      this.executingJobs.add(sitioId);
      
      const site = await Site.findById(schedule.sitioId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      await ScrapingService.scrapeSite(site);

      // Actualizar el schedule después de una ejecución exitosa
      schedule.ultimaEjecucion = new Date();
      schedule.proximaEjecucion = schedule.calcularProximaEjecucion(schedule.ultimaEjecucion);
      schedule.ultimoError = { intentos: 0 };
      schedule.bloqueo = {
        bloqueado: false,
        fechaBloqueo: null,
        razon: null
      };
      
      await schedule.save();

    } catch (error) {
      throw error;
    } finally {
      this.executingJobs.delete(sitioId);
    }
  }

  async manejarError(schedule, error) {
    const intentosActuales = (schedule.ultimoError?.intentos || 0) + 1;
    
    schedule.ultimoError = {
      mensaje: error.message,
      fecha: new Date(),
      intentos: intentosActuales
    };

    if (intentosActuales >= 5) {
      await this.bloquearSchedule(schedule, 'Máximo número de reintentos alcanzado');
    } else {
      schedule.proximaEjecucion = schedule.calcularProximaEjecucion();
      await schedule.save();
      await this.reprogramarSchedule(schedule);
    }
  }

  async bloquearSchedule(schedule, razon) {
    schedule.bloqueo = {
      bloqueado: true,
      fechaBloqueo: new Date(),
      razon: razon
    };
    schedule.proximaEjecucion = schedule.calcularProximaEjecucion();
    await schedule.save();
  }

  async reprogramarSchedule(schedule) {
    const updatedSchedule = await ScrapingSchedule.findById(schedule._id);
    if (!updatedSchedule || !updatedSchedule.activo) {
      console.log(`Schedule ${schedule._id} inactivo o eliminado`);
      this.detenerSchedule(schedule._id);
      return;
    }

    await this.iniciarTimer(updatedSchedule);
  }

  async actualizarSchedule(scheduleId, configuracion) {
    console.log(`Actualizando schedule ${scheduleId}`);
    try {
      const scheduleExistente = await ScrapingSchedule.findById(scheduleId);
      if (!scheduleExistente) {
        throw new Error('Schedule no encontrado');
      }

      this.detenerSchedule(scheduleId);

      // Actualizar el schedule con la nueva configuración
      Object.assign(scheduleExistente, configuracion);
      
      // El pre-save middleware calculará la próxima ejecución
      const scheduleActualizado = await scheduleExistente.save();

      if (scheduleActualizado.activo) {
        await this.iniciarTimer(scheduleActualizado);
      }

      return scheduleActualizado;
    } catch (error) {
      console.error('Error al actualizar schedule:', error);
      throw error;
    }
  }

  async pausarJob(scheduleId) {
    try {
      const schedule = await ScrapingSchedule.findById(scheduleId);
      if (!schedule) {
        throw new Error('Schedule no encontrado');
      }

      this.detenerSchedule(scheduleId);
      schedule.activo = false;
      await schedule.save();

      return schedule;
    } catch (error) {
      console.error('Error al pausar job:', error);
      throw error;
    }
  }

  async reanudarJob(scheduleId) {
    try {
      const schedule = await ScrapingSchedule.findById(scheduleId);
      if (!schedule) {
        throw new Error('Schedule no encontrado');
      }

      schedule.activo = true;
      schedule.bloqueo = {
        bloqueado: false,
        fechaBloqueo: null,
        razon: null
      };
      schedule.ultimoError = {
        intentos: 0
      };

      // El pre-save middleware calculará la próxima ejecución
      await schedule.save();
      await this.iniciarTimer(schedule);

      return schedule;
    } catch (error) {
      console.error('Error al reanudar job:', error);
      throw error;
    }
  }

  detenerSchedule(scheduleId) {
    const timerId = scheduleId.toString();
    if (this.timers.has(timerId)) {
      clearTimeout(this.timers.get(timerId));
      this.timers.delete(timerId);
      this.schedules.delete(timerId);
    }
    this.executingJobs.delete(timerId);
  }

  async obtenerEstadoCola() {
    try {
      const schedules = await ScrapingSchedule.find({ activo: true })
        .populate('sitioId')
        .sort({ prioridad: -1, proximaEjecucion: 1 });

      const jobsEnEjecucion = Array.from(this.executingJobs).map(id => ({
        id,
        inicio: new Date()
      }));

      return {
        jobsEnCola: schedules.length,
        jobsEnEjecucion,
        schedules: schedules,
        proximaEjecucion: schedules[0]?.proximaEjecucion || null
      };
    } catch (error) {
      console.error('Error al obtener estado de la cola:', error);
      throw error;
    }
  }

  async inicializarSchedules() {
    try {
      console.log('Iniciando inicialización de schedules...');
      
      const schedules = await ScrapingSchedule.find({ activo: true })
        .populate('sitioId')
        .sort({ prioridad: -1, proximaEjecucion: 1 });

      console.log(`Encontrados ${schedules.length} schedules activos`);

      for (const schedule of schedules) {
        try {
          if (!schedule.sitioId) {
            console.warn(`Schedule ${schedule._id} sin sitio asociado`);
            continue;
          }

          // El pre-save middleware calculará la próxima ejecución si es necesario
          await schedule.save();
          await this.iniciarTimer(schedule);
          console.log(`Schedule inicializado para sitio: ${schedule.sitioId.nombre}`);
        } catch (error) {
          console.error(`Error al inicializar schedule ${schedule._id}:`, error);
        }
      }

      console.log('Inicialización de schedules completada');
    } catch (error) {
      console.error('Error al inicializar schedules:', error);
      throw error;
    }
  }

  clearAll() {
    for (const [timerId, timer] of this.timers.entries()) {
      clearTimeout(timer);
      this.timers.delete(timerId);
    }
    this.schedules.clear();
    this.executingJobs.clear();
  }
}

module.exports = new ScheduleManagerService();
