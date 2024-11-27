const ScrapingSchedule = require('../models/scrapingSchedule.model');
const ScrapingService = require('./scraping.service');
const Site = require('../models/site.model');

class ScheduleManagerService {
  constructor() {
    this.schedules = new Map();
    this.timers = new Map();
    this.executingJobs = new Set();
  }

  calcularProximaEjecucion(configuracion, fechaReferencia = new Date()) {
    const fecha = new Date(fechaReferencia);
    
    switch (configuracion.tipoFrecuencia) {
      case 'test':
        return new Date(fecha.getTime() + 60000); // 1 minuto
        
      case 'diaria':
        fecha.setHours(0, 0, 0, 0);
        fecha.setDate(fecha.getDate() + 1);
        return fecha;
        
      case 'semanal':
        fecha.setHours(0, 0, 0, 0);
        let diasParaProximaEjecucion = 7;
        if (configuracion.diasSemana && configuracion.diasSemana.length > 0) {
          const diaActual = fecha.getDay();
          const proximosDias = configuracion.diasSemana.map(dia => 
            dia > diaActual ? dia - diaActual : 7 - (diaActual - dia)
          );
          diasParaProximaEjecucion = Math.min(...proximosDias);
        }
        fecha.setDate(fecha.getDate() + diasParaProximaEjecucion);
        return fecha;
        
      case 'mensual':
        fecha.setDate(1);
        fecha.setHours(0, 0, 0, 0);
        fecha.setMonth(fecha.getMonth() + 1);
        return fecha;
        
      default:
        throw new Error(`Tipo de frecuencia no válida: ${configuracion.tipoFrecuencia}`);
    }
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

      const proximaEjecucion = configuracion.scrapingInmediato ? 
        new Date() : 
        this.calcularProximaEjecucion({
          tipoFrecuencia: configuracion.tipoFrecuencia,
          ...configuracion.configuraciones[0]
        });

      const scheduleData = {
        sitioId: configuracion.sitioId,
        tipoFrecuencia: configuracion.tipoFrecuencia,
        configuraciones: configuracion.configuraciones,
        proximaEjecucion,
        prioridad: configuracion.prioridad || 1,
        tags: configuracion.tags || [],
        activo: true
      };

      let schedule;
      try {
        schedule = new ScrapingSchedule(scheduleData);
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

    const proximaEjecucion = schedule.calcularProximaEjecucion();
    if (!proximaEjecucion) {
      console.log(`No hay próximas ejecuciones para el schedule ${schedule._id}`);
      return;
    }

    const ahora = new Date();
    const delay = proximaEjecucion.getTime() - ahora.getTime();

    console.log(`Programando próxima ejecución para ${schedule.sitioId} en ${delay}ms`);

    const timer = setTimeout(async () => {
      try {
        await this.ejecutarSchedule(schedule);
        await this.reprogramarSchedule(schedule);
      } catch (error) {
        console.error(`Error en ejecución programada:`, error);
        await this.manejarError(schedule, error);
      }
    }, delay);

    this.timers.set(schedule._id.toString(), timer);
    this.schedules.set(schedule._id.toString(), schedule);

    await ScrapingSchedule.findByIdAndUpdate(schedule._id, {
      proximaEjecucion,
      ultimaEjecucion: new Date()
    });
  }

  async ejecutarSchedule(schedule) {
    const sitioId = schedule._id.toString();
    
    // Verificar si el sitio ya está siendo scrapeado
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
      
      // Resetear contadores de error al completar exitosamente
      await ScrapingSchedule.findByIdAndUpdate(schedule._id, {
        'ultimoError.intentos': 0,
        'bloqueo.bloqueado': false,
        'bloqueo.fechaBloqueo': null,
        'bloqueo.razon': null
      });

    } catch (error) {
      throw error;
    } finally {
      this.executingJobs.delete(sitioId);
    }
  }

  async manejarError(schedule, error) {
    const intentosActuales = (schedule.ultimoError?.intentos || 0) + 1;
    
    await ScrapingSchedule.findByIdAndUpdate(schedule._id, {
      'ultimoError.mensaje': error.message,
      'ultimoError.fecha': new Date(),
      'ultimoError.intentos': intentosActuales
    });

    if (intentosActuales >= 5) {
      await this.bloquearSchedule(schedule, 'Máximo número de reintentos alcanzado');
    } else {
      await this.reprogramarSchedule(schedule);
    }
  }

  async bloquearSchedule(schedule, razon) {
    await ScrapingSchedule.findByIdAndUpdate(schedule._id, {
      'bloqueo.bloqueado': true,
      'bloqueo.fechaBloqueo': new Date(),
      'bloqueo.razon': razon
    });
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

      const scheduleActualizado = await ScrapingSchedule.findByIdAndUpdate(
        scheduleId,
        {
          ...configuracion,
          proximaEjecucion: this.calcularProximaEjecucion(configuracion)
        },
        { new: true, runValidators: true }
      );

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

      // Resetear estados de error y bloqueo al reanudar
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
