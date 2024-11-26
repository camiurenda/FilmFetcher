const ScrapingSchedule = require('../models/scrapingSchedule.model');
const Site = require('../models/site.model');

class ScheduleManagerService {
  constructor() {
    this.schedules = new Map();
    this.timers = new Map();
    this.scrapingService = null;
  }

  setScrapingService(service) {
    this.scrapingService = service;
    console.log('ScrapingService establecido en ScheduleManager');
  }

  async iniciarTimer(schedule) {
    if (!this.scrapingService) {
      console.error('ScrapingService no inicializado');
      throw new Error('ScrapingService no ha sido inyectado');
    }

    const proximaEjecucion = this.calcularProximaEjecucion(schedule);
    const ahora = new Date();
    const delay = proximaEjecucion.getTime() - ahora.getTime();

    console.log(`Programando timer para ${schedule.sitioId} - Próxima ejecución: ${proximaEjecucion}`);

    const timer = setTimeout(async () => {
      try {
        const site = await Site.findById(schedule.sitioId);
        if (site && this.scrapingService) {
          console.log(`Ejecutando scraping para sitio: ${site.nombre}`);
          await this.scrapingService.ejecutarScrapingSitio(site);
          console.log(`Scraping completado para sitio: ${site.nombre}`);
        } else {
          console.error(`No se pudo encontrar el sitio ${schedule.sitioId} o el servicio no está disponible`);
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
    
    console.log(`Timer iniciado para schedule ${schedule._id}`);
  }

  calcularProximaEjecucion(configuracion) {
    console.log('Calculando próxima ejecución para configuración:', configuracion);
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
        const diasSemana = Array.isArray(configuracion.diasSemana) ? 
          configuracion.diasSemana.map(d => parseInt(d)) : 
          [parseInt(configuracion.diasSemana)];

        while (!diasSemana.includes(proximaEjecucion.getDay()) || proximaEjecucion <= ahora) {
          proximaEjecucion.setDate(proximaEjecucion.getDate() + 1);
        }
        break;

      case 'mensual-dia':
        proximaEjecucion.setDate(parseInt(configuracion.diaMes));
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

    console.log('Próxima ejecución calculada:', proximaEjecucion);
    return proximaEjecucion;
  }

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

  async agregarJob(configuracion) {
    try {
      const sitioExiste = await Site.findById(configuracion.sitioId);
      if (!sitioExiste) {
        throw new Error('El sitio especificado no existe');
      }

      if (!configuracion.tipoFrecuencia || !configuracion.hora) {
        throw new Error('Faltan campos requeridos (tipoFrecuencia, hora)');
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

  async actualizarSchedule(sitioId, configuracion) {
    try {
      const site = await Site.findById(sitioId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      // Validar campos requeridos
      if (!configuracion.tipoFrecuencia || !configuracion.hora) {
        throw new Error('Faltan campos requeridos (tipoFrecuencia, hora)');
      }

      const scheduleExistente = await ScrapingSchedule.findOne({ 
        sitioId, 
        activo: true 
      });

      if (scheduleExistente) {
        const proximaEjecucion = this.calcularProximaEjecucion(configuracion);
        
        // Asegurarse de que todos los campos requeridos estén presentes
        const datosActualizados = {
          ...scheduleExistente.toObject(),
          ...configuracion,
          proximaEjecucion
        };

        const scheduleActualizado = await ScrapingSchedule.findByIdAndUpdate(
          scheduleExistente._id,
          datosActualizados,
          { new: true, runValidators: true }
        );

        if (scheduleActualizado) {
          await this.reiniciarTimer(scheduleActualizado);
          return scheduleActualizado;
        }
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

  async reiniciarTimer(schedule) {
    const timerId = schedule._id.toString();
    if (this.timers.has(timerId)) {
      clearTimeout(this.timers.get(timerId));
      this.timers.delete(timerId);
    }
    await this.iniciarTimer(schedule);
  }

  async detenerSchedule(scheduleId) {
    const timerId = scheduleId.toString();
    if (this.timers.has(timerId)) {
      clearTimeout(this.timers.get(timerId));
      this.timers.delete(timerId);
      this.schedules.delete(timerId);
    }
  }

  async obtenerEstadoCola() {
    try {
      const schedules = await ScrapingSchedule.find({ activo: true })
        .populate('sitioId')
        .sort({ proximaEjecucion: 1 });

      const ejecutandoActualmente = false;
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

  async inicializarSchedules() {
    try {
      console.log('Iniciando inicialización de schedules...');
      
      const schedules = await ScrapingSchedule.find({ activo: true })
        .populate('sitioId');

      console.log(`Encontrados ${schedules.length} schedules activos`);

      for (const schedule of schedules) {
        try {
          if (!schedule.sitioId) {
            console.warn(`Schedule ${schedule._id} sin sitio asociado, saltando...`);
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
  }
}

module.exports = new ScheduleManagerService();