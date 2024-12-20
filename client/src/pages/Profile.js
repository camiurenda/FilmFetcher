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

  const isProduction = !API_URL.includes('localhost');

  const ajustarHora = (fechaStr) => {
    if (!fechaStr) return 'No disponible';
    let fecha = moment(fechaStr);
    if (isProduction) {
      fecha.subtract(3, 'hours');
    }
    return fecha.format('DD/MM/YYYY HH:mm');
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('Iniciando fetchStats');
        const response = await axios.get(`${API_URL}/api/stats`);
        console.log('Respuesta recibida:', response.data);
        setStats(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error detallado al obtener estadísticas:', error);
        setError(error.response?.data?.message || error.message);
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert message="Error" description={error} type="error" showIcon />;
  }

  if (!stats) {
    return <Alert message="No hay datos disponibles" type="warning" showIcon />;
  }

  const cardStyle = {
    background: '#1f1f1f',
    borderRadius: '12px',
    border: '1px solid #303030',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    height: '100%'
  };

  const statCards = [
    { 
      title: 'Sitios Agregados',
      value: stats.sitiosAgregados,
      icon: <DatabaseOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
    },
    {
      title: 'Funciones encontradas',
      value: stats.funcionesScrapeadas,
      icon: <ProjectOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
    },
    {
      title: 'Películas Argentinas',
      value: stats.peliculasArgentinas,
      icon: <CrownOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
    },
    {
      title: 'Película Más Programada',
      value: stats.peliculaTopFunciones,
      icon: <CheckCircleOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
    },
    {
      title: 'Próximo Scraping',
      value: ajustarHora(stats.proximoScraping),
      icon: <ClockCircleOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
    },
    {
      title: 'Último Scraping Exitoso',
      value: ajustarHora(stats.ultimoScrapingExitoso),
      icon: <CheckCircleOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
    },
    {
      title: 'Tasa de Éxito de Scraping',
      value: `${stats.tasaExitoScraping}%`,
      icon: <PercentageOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
    },
    {
      title: 'Sitio Más Activo',
      value: stats.sitioMasActivo,
      icon: <CrownOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
    }
  ];

  return (
    <div style={{ width: '100%' }}>
      <Row gutter={[24, 24]} style={{ margin: 0 }}>
        {statCards.map((stat, index) => (
          <Col xs={24} sm={12} lg={8} key={index} style={{ padding: '12px' }}>
            <Card style={cardStyle} hoverable bodyStyle={{ padding: '24px' }}>
              <Statistic
                title={
                  <div style={{ color: '#e6e6e6', fontSize: '14px', marginBottom: '16px' }}>
                    {stat.title}
                  </div>
                }
                value={stat.value}
                valueStyle={{ color: '#ffffff', fontSize: '24px' }}
                prefix={stat.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default DashboardStats;