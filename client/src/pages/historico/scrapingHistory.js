import React, { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Tag, Tooltip, Space, Select, Row, Col, Card, Statistic } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import API_URL from '../../config/api';

const { Title } = Typography;
const { Option } = Select;

const ScrapingHistory = () => {
  const [historial, setHistorial] = useState([]);
  const [historialFiltrado, setHistorialFiltrado] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sitios, setSitios] = useState([]);
  const [filtros, setFiltros] = useState({
    sitio: 'todos',
    estado: 'todos'
  });
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    exitosos: 0,
    fallidos: 0,
    tasaExito: 0
  });

  useEffect(() => {
    obtenerHistorial();
    obtenerSitios();
  }, []);

  useEffect(() => {
    aplicarFiltros();
  }, [filtros, historial]);

  const obtenerHistorial = async () => {
    try {
      const respuesta = await axios.get(`${API_URL}/api/scraping-history`);
      const datos = Array.isArray(respuesta.data) ? respuesta.data : [];
      const historialOrdenado = [...datos].sort((a, b) => {
        const fechaA = new Date(a.fechaScraping);
        const fechaB = new Date(b.fechaScraping);
        return fechaB - fechaA;
      });
      
      setHistorial(historialOrdenado);
      calcularEstadisticas(historialOrdenado);
      
      console.log('Historial ordenado:', 
        historialOrdenado.map(h => ({
          sitio: h.siteId?.nombre,
          fecha: new Date(h.fechaScraping).toLocaleString('es-AR'),
          estado: h.estado
        }))
      );
    } catch (error) {
      console.error('Error al obtener el historial de scraping:', error);
      message.error('Error al cargar el historial de scraping');
    } finally {
      setCargando(false);
    }
  };

  const obtenerSitios = async () => {
    try {
      const respuesta = await axios.get(`${API_URL}/api/sites`);
      setSitios(respuesta.data);
    } catch (error) {
      console.error('Error al obtener sitios:', error);
    }
  };

  const calcularEstadisticas = (datos) => {
    // Obtener fecha de hace 7 días
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 7);

    // Filtrar solo los registros de los últimos 7 días
    const datosRecientes = datos.filter(d => new Date(d.fechaScraping) >= fechaLimite);
    
    const total = datos.length;
    const exitosos = datos.filter(d => d.estado === 'exitoso').length;
    const fallidos = datos.filter(d => d.estado === 'fallido').length;
    
    // Calcular tasa de éxito solo con los datos de los últimos 7 días
    const exitososRecientes = datosRecientes.filter(d => d.estado === 'exitoso').length;
    const tasaExito = datosRecientes.length > 0 ? 
      (exitososRecientes / datosRecientes.length * 100).toFixed(1) : 0;

    console.log('Estadísticas calculadas:', {
      total,
      exitosos,
      fallidos,
      datosRecientes: datosRecientes.length,
      exitososRecientes,
      tasaExito
    });

    setEstadisticas({
      total,
      exitosos,
      fallidos,
      tasaExito
    });
  };

  const aplicarFiltros = () => {
    let datosFiltrados = [...historial];

    if (filtros.sitio !== 'todos') {
      datosFiltrados = datosFiltrados.filter(
        d => d.siteId?._id === filtros.sitio
      );
    }

    if (filtros.estado !== 'todos') {
      datosFiltrados = datosFiltrados.filter(
        d => d.estado === filtros.estado
      );
    }

    setHistorialFiltrado(datosFiltrados);
    calcularEstadisticas(datosFiltrados);
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
        <Tag color={estado === 'exitoso' ? 'green' : 'red'} icon={estado === 'exitoso' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
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
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row gutter={[16, 16]} align="middle" justify="space-between">
            <Col>
              <Title level={2} style={{ color: '#fff', margin: 0 }}>Historial de Scraping</Title>
            </Col>
            <Col>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={obtenerHistorial}
                loading={cargando}
              >
                Actualizar
              </Button>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic 
                  title="Total de Ejecuciones" 
                  value={estadisticas.total} 
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic 
                  title="Scraping Exitosos" 
                  value={estadisticas.exitosos} 
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic 
                  title="Scraping Fallidos" 
                  value={estadisticas.fallidos} 
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic 
                  title="Tasa de Éxito (últimos 7 días)" 
                  value={estadisticas.tasaExito} 
                  suffix="%" 
                  precision={1}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title={<><FilterOutlined /> Filtros</>}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Select
                  placeholder="Filtrar por sitio"
                  style={{ width: '100%' }}
                  value={filtros.sitio}
                  onChange={(valor) => setFiltros(prev => ({ ...prev, sitio: valor }))}
                >
                  <Option value="todos">Todos los sitios</Option>
                  {sitios.map(sitio => (
                    <Option key={sitio._id} value={sitio._id}>{sitio.nombre}</Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12}>
                <Select
                  placeholder="Filtrar por estado"
                  style={{ width: '100%' }}
                  value={filtros.estado}
                  onChange={(valor) => setFiltros(prev => ({ ...prev, estado: valor }))}
                >
                  <Option value="todos">Todos los estados</Option>
                  <Option value="exitoso">Exitoso</Option>
                  <Option value="fallido">Fallido</Option>
                </Select>
              </Col>
            </Row>
          </Card>

          {cargando ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <Spin size="large" />
            </div>
          ) : (
            <Table 
              columns={columnas} 
              dataSource={historialFiltrado} 
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
        </Space>
      </div>
    </AuthWrapper>
  );
};

export default ScrapingHistory;