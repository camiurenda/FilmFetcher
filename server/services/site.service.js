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

  mapearDatosSitio(datos) {
    // Creamos una copia profunda para no modificar el objeto original
    const datosMapeados = JSON.parse(JSON.stringify(datos));
    
    // Mapeamos la frecuencia principal
    datosMapeados.frecuenciaActualizacion = this.mapearFrecuencia(datos.tipoFrecuencia || datos.frecuenciaActualizacion);
    
    // Mapeamos también en la configuración de scraping si existe
    if (datosMapeados.configuracionScraping?.tipoFrecuencia) {
      datosMapeados.configuracionScraping.tipoFrecuencia = this.mapearFrecuencia(datosMapeados.configuracionScraping.tipoFrecuencia);
    }

    console.log('Datos mapeados para el sitio:', datosMapeados);
    return datosMapeados;
  }

  async agregarSitio(datos) {
    try {
      // Mapear datos para el sitio
      const datosSite = this.mapearDatosSitio(datos);
      console.log('Agregando sitio con datos:', datosSite);
      
      const responseSitio = await axios.post(`${API_URL}/api/sites/add`, datosSite);
      const sitioId = responseSitio.data._id;

      // Datos del schedule mantienen el tipo original
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
      // Mapear datos para el sitio
      const datosSite = this.mapearDatosSitio(datos);
      console.log('Actualizando sitio con datos:', datosSite);
      
      const responseSitio = await axios.put(`${API_URL}/api/sites/${id}`, datosSite);

      // Schedule mantiene el tipo original
      if (datos.tipoCarga === 'scraping' && datos.configuraciones?.length > 0) {
        const scheduleData = {
          sitioId: id,
          tipoFrecuencia: this.mapearFrecuencia(datos.tipoFrecuencia),
          configuraciones: datos.configuraciones,
          tags: datos.tags,
          prioridad: datos.prioridad,
          fechaInicio: datos.fechaInicio,
          fechaFin: datos.fechaFin,
          scrapingInmediato: datos.scrapingInmediato || false
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