import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Alert } from 'antd';
import { DatabaseOutlined, ProjectOutlined, ClockCircleOutlined, CheckCircleOutlined, PercentageOutlined, CrownOutlined } from '@ant-design/icons';
import axios from 'axios';

const gradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)',
  'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(to right, #fa709a 0%, #fee140 100%)',
  'linear-gradient(to right, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)'
];

const cardStyle = (gradient) => ({
  background: gradient,
  borderRadius: '15px',
  boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
  transition: 'all 0.3s ease',
});

const DashboardStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('Iniciando fetchStats');
        const response = await axios.get('http://localhost:5000/api/stats');
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
    return <Spin size="large" />;
  }

  if (error) {
    return <Alert message="Error" description={error} type="error" showIcon />;
  }

  if (!stats) {
    return <Alert message="No hay datos disponibles" type="warning" showIcon />;
  }

  const statCards = [
    { title: 'Sitios Agregados', value: stats.sitiosAgregados, icon: <DatabaseOutlined /> },
    { title: 'Funciones encontradas', value: stats.funcionesScrapeadas, icon: <ProjectOutlined /> },
    { title: 'Próximo Scraping', value: stats.proximoScraping, icon: <ClockCircleOutlined /> },
    { title: 'Último Scraping Exitoso', value: stats.ultimoScrapingExitoso, icon: <CheckCircleOutlined /> },
    { title: 'Tasa de Éxito de Scraping', value: `${stats.tasaExitoScraping}%`, icon: <PercentageOutlined /> },
    { title: 'Sitio Más Activo', value: stats.sitioMasActivo, icon: <CrownOutlined /> }
  ];

  return (
    <Row gutter={[16, 16]}>
      {statCards.map((stat, index) => (
        <Col xs={24} sm={12} lg={8} key={index}>
          <Card
            style={cardStyle(gradients[index % gradients.length])}
            hoverable
            bodyStyle={{ padding: '24px' }}
          >
            <Statistic 
              title={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 'bold' }}>{stat.title}</span>}
              value={stat.value}
              valueStyle={{ color: 'white', fontSize: '24px' }}
              prefix={React.cloneElement(stat.icon, { style: { fontSize: '24px', marginRight: '8px' } })}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default DashboardStats;