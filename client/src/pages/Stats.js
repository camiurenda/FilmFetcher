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
    background: 'linear-gradient(145deg, #1f1f1f 0%, #262626 100%)',
    borderRadius: '16px',
    border: '1px solid #303030',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
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
    background: 'linear-gradient(145deg, #1f1f1f 0%, #262626 100%)',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
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

  const iconStyle = (color = '#4096ff') => ({
    fontSize: '28px',
    background: `linear-gradient(45deg, ${color} 0%, ${color}cc 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    transition: 'all 0.3s ease',
    marginRight: '12px'
  });

  const statCards = [
    { 
      title: 'Sitios Agregados',
      value: stats.sitiosAgregados || 0,
      icon: <DatabaseOutlined style={iconStyle('#4096ff')} />,
      color: '#4096ff'
    },
    {
      title: 'Funciones Encontradas',
      value: stats.funcionesScrapeadas || 0,
      icon: <ProjectOutlined style={iconStyle('#40a9ff')} />,
      color: '#40a9ff'
    },
    {
      title: 'Películas Argentinas',
      value: stats.peliculasArgentinas || 0,
      icon: <CrownOutlined style={iconStyle('#36cfc9')} />,
      color: '#36cfc9'
    },
    {
      title: 'Película Más Programada',
      value: stats.peliculaTopFunciones || 'No hay datos',
      icon: <CheckCircleOutlined style={iconStyle('#73d13d')} />,
      color: '#73d13d'
    },
    {
      title: 'Próximo Scraping',
      value: formatearProximoScraping(stats.proximoScraping),
      icon: <ClockCircleOutlined style={iconStyle('#ffd666')} />,
      color: '#ffd666'
    },
    {
      title: 'Último Scraping Exitoso',
      value: formatearUltimoScraping(stats.ultimoScrapingExitoso),
      icon: <CheckCircleOutlined style={iconStyle('#95de64')} />,
      color: '#95de64'
    },
    {
      title: 'Tasa de Éxito de Scraping',
      value: `${stats.tasaExitoScraping || 0}%`,
      icon: <PercentageOutlined style={iconStyle('#ff7a45')} />,
      color: '#ff7a45'
    },
    {
      title: 'Sitio Más Activo',
      value: stats.sitioMasActivo || 'No disponible',
      icon: <CrownOutlined style={iconStyle('#ffc53d')} />,
      color: '#ffc53d'
    }
  ];

  return (
    <div style={{ width: '100%' }}>
      <Row gutter={[24, 24]} style={{ margin: 0 }}>
        {statCards.map((stat, index) => (
          <Col xs={24} sm={12} lg={8} key={index} style={{ 
            padding: '12px',
            animation: `fadeIn 0.3s ease forwards ${index * 0.1}s`
          }}>
            <Card 
              style={{
                ...cardStyle,
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: `0 8px 30px ${stat.color}15`
                }
              }}
              hoverable 
              bodyStyle={{ 
                padding: '24px',
                transition: 'all 0.3s ease',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <Statistic
                title={
                  <div style={{ 
                    color: '#e6e6e6', 
                    fontSize: '16px', 
                    marginBottom: '16px',
                    fontWeight: '500',
                    letterSpacing: '0.5px'
                  }}>
                    {stat.title}
                  </div>
                }
                value={stat.value}
                valueStyle={{ 
                  color: '#ffffff', 
                  fontSize: '26px',
                  fontWeight: '600',
                  background: `linear-gradient(45deg, #ffffff 30%, ${stat.color} 90%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
                prefix={stat.icon}
              />
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
