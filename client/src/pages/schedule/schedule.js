import React, { useEffect, useState } from 'react';
import { Table, Typography, Spin, message } from 'antd';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import API_URL from '../../config/api';

const { Title } = Typography;

const ScrapingSchedule = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sites/scraping-schedule`);
      setSchedule(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching scraping schedule:', error);
      message.error('Error al cargar el horario de scraping');
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Nombre del Sitio',
      dataIndex: 'nombre',
      key: 'nombre',
    },
    {
      title: 'Frecuencia',
      dataIndex: 'frecuencia',
      key: 'frecuencia',
    },
    {
      title: 'Último Scraping',
      dataIndex: 'ultimoScraping',
      key: 'ultimoScraping',
      render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
    },
    {
      title: 'Próximo Scraping',
      dataIndex: 'proximoScraping',
      key: 'proximoScraping',
      render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
    },
  ];

  return (
    <AuthWrapper>
      <div style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        <Title level={2} style={{ color: '#fff', marginBottom: '24px' }}>Horario de Scraping</Title>
        {loading ? (
          <Spin size="large" />
        ) : (
          <Table 
            columns={columns} 
            dataSource={schedule} 
            rowKey="siteId"
            pagination={{ 
              responsive: true,
              showSizeChanger: true, 
              showQuickJumper: true,
            }}
          />
        )}
      </div>
    </AuthWrapper>
  );
};

export default ScrapingSchedule;