// src/services/site.service.js
import axios from 'axios';
import API_URL from '../config/api';

class SiteService {
  async agregarSitio(datos) {
    try {
      // Primero crear el sitio
      const responseSitio = await axios.post(`${API_URL}/api/sites/add`, datos);
      const sitioId = responseSitio.data._id;

      // Si es scraping, crear el schedule
      if (datos.tipoCarga === 'scraping' && datos.configuraciones?.length > 0) {
        const scheduleData = {
          sitioId,
          tipoFrecuencia: datos.tipoFrecuencia,
          configuraciones: datos.configuraciones,
          tags: datos.tags,
          prioridad: datos.prioridad,
          fechaInicio: datos.fechaInicio,
          fechaFin: datos.fechaFin,
          scrapingInmediato: datos.scrapingInmediato || false
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
      // Actualizar sitio
      const responseSitio = await axios.put(`${API_URL}/api/sites/${id}`, datos);

      // Si es scraping, actualizar o crear schedule
      if (datos.tipoCarga === 'scraping' && datos.configuraciones?.length > 0) {
        const scheduleData = {
          sitioId: id,
          tipoFrecuencia: datos.tipoFrecuencia,
          configuraciones: datos.configuraciones,
          tags: datos.tags,
          prioridad: datos.prioridad,
          fechaInicio: datos.fechaInicio,
          fechaFin: datos.fechaFin,
          scrapingInmediato: datos.scrapingInmediato || false
        };

        // Intentar actualizar schedule existente
        try {
          const scheduleResponse = await axios.get(`${API_URL}/api/scraping-schedule/sitio/${id}`);
          if (scheduleResponse.data._id) {
            await axios.put(`${API_URL}/api/scraping-schedule/${scheduleResponse.data._id}`, scheduleData);
          } else {
            await axios.post(`${API_URL}/api/scraping-schedule`, scheduleData);
          }
        } catch (error) {
          // Si no existe schedule, crear uno nuevo
          if (error.response?.status === 404) {
            await axios.post(`${API_URL}/api/scraping-schedule`, scheduleData);
          } else {
            throw error;
          }
        }
      }

      return responseSitio.data;
    } catch (error) {
      console.error('Error al actualizar sitio:', error);
      throw error;
    }
  }

  async obtenerSitios() {
    try {
      const response = await axios.get(`${API_URL}/api/sites`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener sitios:', error);
      throw error;
    }
  }
}

export default new SiteService();
