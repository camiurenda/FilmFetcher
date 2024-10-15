import React, { useEffect, useState } from 'react';
import { Table, Typography, Spin, message } from 'antd';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import API_URL from '../../config/api';

const { Title } = Typography;

const ScrapingHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      // Cambiamos la URL para que coincida con la nueva ruta en el servidor
      const response = await axios.get(`${API_URL}/api/scraping-history`);
      setHistory(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching scraping history:', error);
      message.error('Error al cargar el historial de scraping');
      setLoading(false);
    }
  };
  
  const columns = [
    {
      title: 'Nombre del Sitio',
      dataIndex: ['siteId', 'nombre'],
      key: 'nombre',
    },
    {
      title: 'Fecha de Scraping',
      dataIndex: 'fechaScraping',
      key: 'fechaScraping',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Cantidad de Proyecciones',
      dataIndex: 'cantidadProyecciones',
      key: 'cantidadProyecciones',
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      render: (estado) => (
        <span style={{ color: estado === 'exitoso' ? 'green' : 'red' }}>
          {estado.charAt(0).toUpperCase() + estado.slice(1)}
        </span>
      ),
    },
    {
      title: 'Mensaje de Error',
      dataIndex: 'mensajeError',
      key: 'mensajeError',
      render: (mensaje) => mensaje || 'N/A',
    },
  ];

  return (
    <AuthWrapper>
      <div style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        <Title level={2} style={{ color: '#fff', marginBottom: '24px' }}>Historial de Scraping</Title>
        {loading ? (
          <Spin size="large" />
        ) : (
          <Table 
            columns={columns} 
            dataSource={history} 
            rowKey="_id"
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

export default ScrapingHistory;