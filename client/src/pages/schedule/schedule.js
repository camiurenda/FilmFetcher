import React, { useEffect, useState } from 'react';
import { Table, Typography, Spin, message, Empty, Alert } from 'antd';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import API_URL from '../../config/api';

const { Title } = Typography;

const ScrapingSchedule = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/scraping-schedule`);
      setSchedule(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching scraping schedule:', error);
      setError(error.response?.data?.error || 'Error al cargar el horario de scraping');
      message.error('Error al cargar el horario de scraping');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Nombre del Sitio',
      dataIndex: ['sitioId', 'nombre'],
      key: 'nombre',
      render: (nombre, record) => nombre || record.sitioId?.nombre || 'No disponible'
    },
    {
      title: 'Frecuencia',
      dataIndex: 'tipoFrecuencia',
      key: 'frecuencia',
      render: (frecuencia) => frecuencia || 'No especificada'
    },
    {
      title: 'Último Scraping',
      dataIndex: 'ultimaEjecucion',
      key: 'ultimoScraping',
      render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
    },
    {
      title: 'Próximo Scraping',
      dataIndex: 'proximaEjecucion',
      key: 'proximoScraping',
      render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
    },
  ];

  return (
    <AuthWrapper>
      <div style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        <Title level={2} style={{ color: '#fff', marginBottom: '24px' }}>Horario de Scraping</Title>
        
        {error && (
          <Alert
            message="Error al cargar datos"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : schedule.length > 0 ? (
          <Table 
            columns={columns} 
            dataSource={schedule} 
            rowKey={record => record._id || Math.random()}
            pagination={{ 
              responsive: true,
              showSizeChanger: true, 
              showQuickJumper: true,
            }}
          />
        ) : (
          <Empty
            description="No hay horarios de scraping configurados"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>
    </AuthWrapper>
  );
};

export default ScrapingSchedule;