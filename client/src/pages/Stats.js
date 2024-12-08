import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Alert } from 'antd';
import { DatabaseOutlined, ProjectOutlined, ClockCircleOutlined, CheckCircleOutlined, PercentageOutlined, CrownOutlined } from '@ant-design/icons';
import axios from 'axios';
import API_URL from '../config/api';
import moment from 'moment-timezone';

const DashboardStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatearFecha = (fechaISO) => {
    if (!fechaISO) return 'No disponible';
    const fecha = moment(fechaISO);
    if (!fecha.isValid()) return 'Fecha inválida';
    
    const ahora = moment();
    const diferencia = fecha.diff(ahora, 'hours');

    // Si la fecha es hoy, mostrar "Hoy a las HH:mm"
    if (fecha.isSame(ahora, 'day')) {
      return `Hoy a las ${fecha.format('HH:mm')}`;
    }
    // Si es mañana, mostrar "Mañana a las HH:mm"
    else if (fecha.isSame(ahora.clone().add(1, 'day'), 'day')) {
      return `Mañana a las ${fecha.format('HH:mm')}`;
    }
    // Para otras fechas, mostrar la fecha completa
    return fecha.format('DD/MM/YYYY, HH:mm');
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('📊 [Stats] Iniciando obtención de estadísticas');
        const response = await axios.get(`${API_URL}/api/stats`);
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

  if (loading) return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;
  if (!stats) return <Alert message="No hay datos disponibles" type="warning" showIcon />;

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
      title: 'Funciones Encontradas',
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
      value: formatearFecha(stats.proximoScraping),
      icon: <ClockCircleOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
    },
    {
      title: 'Último Scraping Exitoso',
      value: formatearFecha(stats.ultimoScrapingExitoso),
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