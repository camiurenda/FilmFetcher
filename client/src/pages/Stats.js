import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Alert } from 'antd';
import { DatabaseOutlined, ProjectOutlined, ClockCircleOutlined, CheckCircleOutlined, PercentageOutlined, CrownOutlined } from '@ant-design/icons';
import axios from 'axios';
import API_URL from '../config/api';
import moment from 'moment';

const DashboardStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('📊 [Stats] Iniciando obtención de estadísticas');
        const response = await axios.get(`${API_URL}/api/stats`);
        console.log('📊 [Stats] Datos recibidos:', response.data);
        setStats(response.data);
        setLoading(false);
      } catch (error) {
        console.error('❌ [Stats] Error:', error);
        setError(error.response?.data?.message || error.message);
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const cardStyle = {
    background: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #303030',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    height: '100%',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
    position: 'relative'
  };

  const loadingContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '300px',
    background: '#1a1a1a',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  };

  if (loading) return (
    <div style={loadingContainerStyle}>
      <Spin size="large" />
    </div>
  );
  
  if (error) return (
    <Alert 
      message="Error" 
      description={error} 
      type="error" 
      showIcon 
      style={{
        background: '#2a1215',
        border: '1px solid #5c1d24',
        borderRadius: '8px'
      }}
    />
  );
  
  if (!stats) return (
    <Alert 
      message="No hay datos disponibles" 
      type="warning" 
      showIcon 
      style={{
        background: '#2b2111',
        border: '1px solid #594214',
        borderRadius: '8px'
      }}
    />
  );

  const formatearProximoScraping = (proximoScraping) => {
    if (!proximoScraping || !proximoScraping.fecha) return 'No programado';
    try {
      const fecha = moment(proximoScraping.fecha);
      return `${proximoScraping.sitio || 'Desconocido'} (${fecha.format('DD/MM/YYYY HH:mm')})`;
    } catch (error) {
      console.error('Error al formatear próximo scraping:', error);
      return 'Error en formato';
    }
  };

  const formatearUltimoScraping = (ultimoScraping) => {
    if (!ultimoScraping || !ultimoScraping.fecha) return 'No disponible';
    try {
      const fecha = moment(ultimoScraping.fecha);
      return `${ultimoScraping.sitio || 'Desconocido'} (${fecha.format('DD/MM/YYYY HH:mm')})`;
    } catch (error) {
      console.error('Error al formatear último scraping:', error);
      return 'Error en formato';
    }
  };

  const iconStyle = {
    fontSize: '22px',
    marginRight: '10px',
    color: '#1890ff'
  };

  const statCards = [
    { 
      title: 'Sitios Agregados',
      value: stats.sitiosAgregados || 0,
      icon: <DatabaseOutlined style={iconStyle} />,
      subtitle: 'Sitios monitoreados en la plataforma'
    },
    {
      title: 'Funciones Encontradas',
      value: stats.funcionesScrapeadas || 0,
      icon: <ProjectOutlined style={iconStyle} />,
      subtitle: 'Funciones disponibles en total'
    },
    {
      title: 'Películas Argentinas',
      value: stats.peliculasArgentinas || 0,
      icon: <CrownOutlined style={iconStyle} />,
      subtitle: 'Películas de origen argentino'
    },
    {
      title: 'Película Más Programada',
      value: stats.peliculaTopFunciones || 'No hay datos',
      icon: <CheckCircleOutlined style={iconStyle} />,
      subtitle: 'Más exhibida en cartelera'
    },
    {
      title: 'Próximo Scraping',
      value: formatearProximoScraping(stats.proximoScraping),
      icon: <ClockCircleOutlined style={iconStyle} />,
      subtitle: 'En 1 hora'
    },
    {
      title: 'Último Scraping Exitoso',
      value: formatearUltimoScraping(stats.ultimoScrapingExitoso),
      icon: <CheckCircleOutlined style={iconStyle} />,
      subtitle: 'Última vez que se completó correctamente'
    },
    {
      title: 'Tasa de Éxito de Scraping',
      value: `${stats.tasaExitoScraping || 0}%`,
      icon: <PercentageOutlined style={iconStyle} />,
      subtitle: 'Porcentaje de operaciones exitosas'
    },
    {
      title: 'Sitio Más Activo',
      value: stats.sitioMasActivo || 'No disponible',
      icon: <CrownOutlined style={iconStyle} />,
      subtitle: 'Con mayor cantidad de funciones'
    }
  ];

  return (
    <div style={{ width: '100%' }}>
      <Row gutter={[16, 16]} style={{ margin: 0 }}>
        {statCards.map((stat, index) => (
          <Col xs={24} sm={12} lg={8} key={index} style={{ 
            padding: '12px',
            animation: `fadeIn 0.3s ease forwards ${index * 0.1}s`
          }}>
            <Card 
              style={cardStyle}
              bodyStyle={{ 
                padding: '16px',
                height: '100%'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  {stat.icon}
                  <span style={{ 
                    color: '#e6e6e6', 
                    fontSize: '16px',
                    fontWeight: '500'
                  }}>
                    {stat.title}
                  </span>
                </div>
                <div style={{ 
                  fontSize: '28px', 
                  fontWeight: 'bold', 
                  color: '#fff',
                  marginBottom: '8px',
                  marginLeft: '32px'
                }}>
                  {stat.value}
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#8c8c8c',
                  marginLeft: '32px' 
                }}>
                  {stat.subtitle}
                </div>
                {stat.title === 'Tasa de Éxito de Scraping' && (
                  <div style={{
                    position: 'relative',
                    width: '80px',
                    height: '80px',
                    float: 'right',
                    marginTop: '-80px'
                  }}>
                    <div style={{
                      position: 'absolute',
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: `radial-gradient(closest-side, #1a1a1a 79%, transparent 80% 100%),
                                  conic-gradient(#1890ff ${stats.tasaExitoScraping || 0}%, #333 0)`
                    }}></div>
                  </div>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default DashboardStats;