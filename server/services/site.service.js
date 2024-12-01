import axios from 'axios';
import API_URL from '../config/api';
import dayjs from 'dayjs';

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
            hora: config.hora ? dayjs(config.hora, 'HH:mm') : null
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
      
      // Formatear configuraciones antes de enviar
      const datosFormateados = {
        ...datos,
        configuraciones: datos.configuraciones?.map(config => ({
          ...config,
          hora: config.hora ? dayjs(config.hora).format('HH:mm') : '09:00'
        }))
      };

      const responseSitio = await axios.post(`${API_URL}/api/sites/add`, datosFormateados);
      const sitioId = responseSitio.data._id;

      if (datos.tipoCarga === 'scraping' && datos.configuraciones?.length > 0) {
        const scheduleData = {
          sitioId,
          tipoFrecuencia: datos.tipoFrecuencia,
          configuraciones: datosFormateados.configuraciones
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
      
      // Formatear configuraciones antes de enviar
      const datosFormateados = {
        ...datos,
        configuraciones: datos.configuraciones?.map(config => ({
          ...config,
          hora: config.hora ? dayjs(config.hora).format('HH:mm') : '09:00'
        }))
      };

      const responseSitio = await axios.put(`${API_URL}/api/sites/${id}`, datosFormateados);

      if (datos.tipoCarga === 'scraping' && datos.configuraciones?.length > 0) {
        const scheduleData = {
          sitioId: id,
          tipoFrecuencia: datos.tipoFrecuencia,
          configuraciones: datosFormateados.configuraciones
        };

        try {
          const scheduleResponse = await axios.get(`${API_URL}/api/scraping-schedule/sitio/${id}`);
          if (scheduleResponse.data._id) {
            await axios.put(`${API_URL}/api/scraping-schedule/${scheduleResponse.data._id}`, scheduleData);
          } else {
            await axios.post(`${API_URL}/api/scraping-schedule`, scheduleData);
          }
        } catch (error) {
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
}

export default new SiteService();