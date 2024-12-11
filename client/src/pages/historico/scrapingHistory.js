import React, { useEffect, useState } from 'react';
import { Table, Typography, Spin, message, Tag, Tooltip } from 'antd';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import API_URL from '../../config/api';

const { Title } = Typography;

const ScrapingHistory = () => {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerHistorial();
  }, []);

  const obtenerHistorial = async () => {
    try {
      const respuesta = await axios.get(`${API_URL}/api/scraping-history`);
      const datos = Array.isArray(respuesta.data) ? respuesta.data : [];
      // Ordenar por fecha de scraping (más reciente primero)
      const historialOrdenado = datos.sort((a, b) => 
        new Date(b.fechaScraping) - new Date(a.fechaScraping)
      );
      setHistorial(historialOrdenado);
    } catch (error) {
      console.error('Error al obtener el historial de scraping:', error);
      message.error('Error al cargar el historial de scraping');
    } finally {
      setCargando(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Fecha inválida';
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const columnas = [
    {
      title: 'Nombre del Sitio',
      dataIndex: ['siteId', 'nombre'],
      key: 'nombre',
      render: (nombre, record) => nombre || record.siteId?.nombre || 'Desconocido',
    },
    {
      title: 'Fecha de Scraping',
      dataIndex: 'fechaScraping',
      key: 'fechaScraping',
      render: (fecha) => {
        const fechaFormateada = formatearFecha(fecha);
        return <Tooltip title={fechaFormateada}>{fechaFormateada}</Tooltip>;
      },
      sorter: (a, b) => new Date(b.fechaScraping) - new Date(a.fechaScraping),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Cantidad de Proyecciones',
      dataIndex: 'cantidadProyecciones',
      key: 'cantidadProyecciones',
      render: (cantidad) => cantidad || 0,
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      render: (estado) => (
        <Tag color={estado === 'exitoso' ? 'green' : 'red'}>
          {(estado || 'Desconocido').charAt(0).toUpperCase() + (estado || 'Desconocido').slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Mensaje de Error',
      dataIndex: 'mensajeError',
      key: 'mensajeError',
      render: (mensaje) => (
        <Tooltip title={mensaje || 'N/A'}>
          <span>{mensaje ? (mensaje.length > 50 ? `${mensaje.substring(0, 50)}...` : mensaje) : 'N/A'}</span>
        </Tooltip>
      ),
    },
  ];

  return (
    <AuthWrapper>
      <div style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        <Title level={2} style={{ color: '#fff', marginBottom: '24px' }}>Historial de Scraping</Title>
        {cargando ? (
          <Spin size="large" />
        ) : (
          <Table 
            columns={columnas} 
            dataSource={historial} 
            rowKey={(record) => record._id || Math.random().toString()}
            pagination={{ 
              responsive: true,
              showSizeChanger: true, 
              showQuickJumper: true,
              defaultPageSize: 10,
              showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} registros`,
            }}
          />
        )}
      </div>
    </AuthWrapper>
  );
};

export default ScrapingHistory;