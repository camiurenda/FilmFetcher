import axios from 'axios';
import API_URL from '../config/api';

class SiteService {
  mapearFrecuencia(tipoFrecuencia) {
    const mapeo = {
      'mensual-dia': 'mensual',
      'mensual-posicion': 'mensual'
    };
    return mapeo[tipoFrecuencia] || tipoFrecuencia;
  }

  async agregarSitio(datos) {
    try {
      // Mapear frecuencia para el modelo Site
      const datosSite = {
        ...datos,
        frecuenciaActualizacion: this.mapearFrecuencia(datos.tipoFrecuencia)
      };

      console.log('Agregando sitio con datos:', datosSite);
      const responseSitio = await axios.post(`${API_URL}/api/sites/add`, datosSite);
      const sitioId = responseSitio.data._id;

      // Si es scraping, crear el schedule con el tipo original
      if (datos.tipoCarga === 'scraping' && datos.configuraciones?.length > 0) {
        const scheduleData = {
          sitioId,
          tipoFrecuencia: datos.tipoFrecuencia, // Mantenemos el tipo original
          configuraciones: datos.configuraciones,
          tags: datos.tags,
          prioridad: datos.prioridad,
          fechaInicio: datos.fechaInicio,
          fechaFin: datos.fechaFin,
          scrapingInmediato: datos.scrapingInmediato || false
        };

        console.log('Creando schedule con datos:', scheduleData);
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
      // Mapear frecuencia para el modelo Site
      const datosSite = {
        ...datos,
        frecuenciaActualizacion: this.mapearFrecuencia(datos.tipoFrecuencia)
      };

      console.log('Actualizando sitio con datos:', datosSite);
      const responseSitio = await axios.put(`${API_URL}/api/sites/${id}`, datosSite);

      // Si es scraping, actualizar o crear schedule con el tipo original
      if (datos.tipoCarga === 'scraping' && datos.configuraciones?.length > 0) {
        const scheduleData = {
          sitioId: id,
          tipoFrecuencia: datos.tipoFrecuencia, // Mantenemos el tipo original
          configuraciones: datos.configuraciones,
          tags: datos.tags,
          prioridad: datos.prioridad,
          fechaInicio: datos.fechaInicio,
          fechaFin: datos.fechaFin,
          scrapingInmediato: datos.scrapingInmediato || false
        };

        try {
          console.log('Buscando schedule existente para sitio:', id);
          const scheduleResponse = await axios.get(`${API_URL}/api/scraping-schedule/sitio/${id}`);
          if (scheduleResponse.data._id) {
            console.log('Actualizando schedule existente:', scheduleResponse.data._id);
            await axios.put(`${API_URL}/api/scraping-schedule/${scheduleResponse.data._id}`, scheduleData);
          } else {
            console.log('Creando nuevo schedule');
            await axios.post(`${API_URL}/api/scraping-schedule`, scheduleData);
          }
        } catch (error) {
          if (error.response?.status === 404) {
            console.log('Schedule no encontrado, creando uno nuevo');
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