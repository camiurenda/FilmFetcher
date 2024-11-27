// site.service.js
import axios from 'axios';
import API_URL from '../config/api';

class SiteService {
  async obtenerSitioConSchedule(id) {
    try {
      console.log('Obteniendo sitio con schedule:', id);
      const [sitioResponse, schedulesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/sites/${id}`),
        axios.get(`${API_URL}/api/scraping-schedule`)
      ]);

      const sitio = sitioResponse.data;
      const schedules = schedulesResponse.data;
      console.log('Datos obtenidos:', { sitio, schedules });

      const scheduleExistente = schedules.find(s => s.sitioId === id);
      
      if (scheduleExistente) {
        console.log('Schedule encontrado:', scheduleExistente);
        return {
          ...sitio,
          tipoFrecuencia: scheduleExistente.tipoFrecuencia,
          configuraciones: scheduleExistente.configuraciones.map(config => ({
            ...config,
            hora: config.hora ? new Date(`1970-01-01T${config.hora}`) : null
          }))
        };
      }

      console.log('No se encontró schedule para el sitio');
      return sitio;
    } catch (error) {
      console.error('Error en obtenerSitioConSchedule:', error);
      throw error;
    }
  }

  async agregarSitio(datos) {
    try {
      console.log('Agregando nuevo sitio:', datos);
      const responseSitio = await axios.post(`${API_URL}/api/sites/add`, datos);
      const sitioId = responseSitio.data._id;

      if (datos.tipoCarga === 'scraping') {
        const scheduleData = {
          sitioId,
          tipoFrecuencia: datos.tipoFrecuencia,
          configuraciones: datos.configuraciones
        };

        await axios.post(`${API_URL}/api/scraping-schedule`, scheduleData);
      }

      return responseSitio.data;
    } catch (error) {
      console.error('Error al agregar sitio:', error);
      throw error;
    }
  }

  async actualizarSitio(id, datos) {
    try {
      console.log('Actualizando sitio:', { id, datos });
      const responseSitio = await axios.put(`${API_URL}/api/sites/${id}`, datos);

      if (datos.tipoCarga === 'scraping') {
        const scheduleData = {
          sitioId: id,
          tipoFrecuencia: datos.tipoFrecuencia,
          configuraciones: datos.configuraciones.map(config => ({
            ...config,
            hora: config.hora instanceof Date ? 
              config.hora.toTimeString().slice(0, 5) : 
              config.hora
          }))
        };

        const schedules = await axios.get(`${API_URL}/api/scraping-schedule`);
        const scheduleExistente = schedules.data.find(s => s.sitioId === id);

        if (scheduleExistente) {
          await axios.put(`${API_URL}/api/scraping-schedule/${scheduleExistente._id}`, scheduleData);
        } else {
          await axios.post(`${API_URL}/api/scraping-schedule`, scheduleData);
        }
      }

      return responseSitio.data;
    } catch (error) {
      console.error('Error al actualizar sitio:', error);
      throw error;
    }
  }
}

export default new SiteService();