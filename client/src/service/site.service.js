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
      if (datos.tipoCarga === 'scraping') {
        const scheduleData = {
          sitioId,
          tipoFrecuencia: datos.tipoFrecuencia,
          hora: datos.hora,
          diasSemana: datos.diasSemana,
          diaMes: datos.diaMes,
          semanaMes: datos.semanaMes,
          diaSemana: datos.diaSemana,
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

      // Obtener schedule existente
      const schedules = await axios.get(`${API_URL}/api/scraping-schedule`);
      const scheduleExistente = schedules.data.find(s => s.sitioId === id);

      if (datos.tipoCarga === 'scraping') {
        const scheduleData = {
          sitioId: id,
          tipoFrecuencia: datos.tipoFrecuencia,
          hora: datos.hora,
          diasSemana: datos.diasSemana,
          diaMes: datos.diaMes,
          semanaMes: datos.semanaMes,
          diaSemana: datos.diaSemana,
          scrapingInmediato: datos.scrapingInmediato || false
        };

        if (scheduleExistente) {
          // Actualizar schedule existente
          await axios.put(`${API_URL}/api/scraping-schedule/${scheduleExistente._id}`, scheduleData);
        } else {
          // Crear nuevo schedule
          await axios.post(`${API_URL}/api/scraping-schedule`, scheduleData);
        }
      } else if (scheduleExistente) {
        // Si cambia a manual y existe schedule, pausarlo
        await axios.post(`${API_URL}/api/scraping-schedule/${scheduleExistente._id}/pausar`);
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