import React, { useEffect, useState } from 'react';
import { 
  Table, 
  Typography, 
  Spin, 
  message, 
  Empty, 
  Alert, 
  Button, 
  Space,
  Card,
  Statistic,
  Badge,
  Tag,
  Tooltip,
  Row,
  Col,
  Progress,
  Modal,
  List
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CalendarOutlined,
  ReloadOutlined,
  FieldTimeOutlined,
  CopyOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import axios from 'axios';
import API_URL from '../../config/api';
import moment from 'moment';

const { Title, Text } = Typography;

const ScrapingSchedule = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    programadosHoy: 0,
    completados: 0,
    fallidos: 0,
    proximoScraping: null,
    sitiosSinSchedule: []
  });
  const [actualizando, setActualizando] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [sitiosSinScheduleModalVisible, setSitiosSinScheduleModalVisible] = useState(false);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [scheduleResponse, statsResponse, sitesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/scraping-schedule`),
        axios.get(`${API_URL}/api/stats`),
        axios.get(`${API_URL}/api/sites`)
      ]);
      
      const ahora = moment();
      const schedules = scheduleResponse.data
        .map(schedule => ({
          ...schedule,
          key: schedule._id,
          sitioNombre: schedule.sitioId?.nombre || 'No disponible',
          tipoFrecuencia: schedule.tipoFrecuencia || 'No especificada',
          ultimaEjecucion: schedule.ultimaEjecucion ? moment(schedule.ultimaEjecucion) : null,
          proximaEjecucion: schedule.proximaEjecucion ? moment(schedule.proximaEjecucion) : null
        }))
        .filter(schedule => {
          const proximaEjecucion = schedule.proximaEjecucion;
          if (!proximaEjecucion) return false;
          return mostrarAnteriores ? 
            proximaEjecucion.isBefore(ahora) : 
            proximaEjecucion.isSameOrAfter(ahora);
        })
        .sort((a, b) => {
          if (!a.proximaEjecucion || !b.proximaEjecucion) return 0;
          return a.proximaEjecucion.diff(b.proximaEjecucion);
        });

      // Encontrar sitios sin schedule
      const sitiosConSchedule = new Set(schedules.map(s => s.sitioId?._id));
      const sitiosSinSchedule = sitesResponse.data.filter(site => !sitiosConSchedule.has(site._id));

      // Calcular estadísticas
      const programadosHoy = schedules.filter(s => 
        s.proximaEjecucion && s.proximaEjecucion.isSame(ahora, 'day')
      ).length;

      const completados = schedules.filter(s => s.ultimaEjecucion).length;
      const fallidos = schedules.filter(s => s.ultimoError).length;
      
      setSchedule(schedules);
      setEstadisticas({
        total: schedules.length,
        programadosHoy,
        completados,
        fallidos,
        tasaExito: statsResponse.data.tasaExitoScraping,
        proximoScraping: statsResponse.data.proximoScraping,
        sitiosSinSchedule
      });

    } catch (error) {
      console.error('Error al cargar schedules:', error);
      setError(error.response?.data?.message || 'Error al cargar el horario de scraping');
      message.error('Error al cargar el horario de scraping');
    } finally {
      setLoading(false);
      setActualizando(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
    const intervalo = setInterval(fetchSchedule, 60000);
    return () => clearInterval(intervalo);
  }, [mostrarAnteriores]);

  const handleRefresh = () => {
    setActualizando(true);
    fetchSchedule();
  };

  const handleCopyId = (id, siteName) => {
    navigator.clipboard.writeText(id).then(() => {
      message.success(`ID de ${siteName} copiado al portapapeles`);
    }).catch(() => {
      message.error('Error al copiar el ID');
    });
  };

  const columns = [
    {
      title: 'Nombre del Sitio',
      dataIndex: 'sitioNombre',
      key: 'sitioNombre',
      fixed: 'left',
      render: (sitioNombre, record) => (
        <Space>
          <Text 
            style={{ 
              cursor: 'pointer', 
              color: '#1890ff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onClick={() => handleCopyId(record._id, sitioNombre)}
          >
            {sitioNombre}
            <CopyOutlined style={{ fontSize: '14px' }} />
          </Text>
        </Space>
      )
    },
    {
      title: 'Frecuencia',
      dataIndex: 'tipoFrecuencia',
      key: 'tipoFrecuencia',
      render: (tipoFrecuencia) => (
        <Tag color="blue">
          {tipoFrecuencia.charAt(0).toUpperCase() + tipoFrecuencia.slice(1)}
        </Tag>
      )
    },
    {
      title: 'Último Scraping',
      key: 'ultimaEjecucion',
      render: (_, record) => (
        <Space>
          <Badge 
            status={record.ultimoError ? 'error' : 'success'} 
            text={
              record.ultimaEjecucion ? (
                <Tooltip title={record.ultimoError?.mensaje}>
                  <span>
                    {record.ultimaEjecucion.format('DD/MM/YYYY HH:mm')}
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      ({record.ultimaEjecucion.fromNow()})
                    </Text>
                  </span>
                </Tooltip>
              ) : 'Nunca'
            }
          />
        </Space>
      )
    },
    {
      title: 'Próximo Scraping',
      key: 'proximaEjecucion',
      render: (_, record) => (
        record.proximaEjecucion ? (
          <Space>
            <ClockCircleOutlined />
            <span>{record.proximaEjecucion.format('DD/MM/YYYY HH:mm')}</span>
            <Text type="secondary">
              ({record.proximaEjecucion.fromNow()})
            </Text>
          </Space>
        ) : 'No programado'
      )
    },
    {
      title: 'Estado',
      key: 'estado',
      render: (_, record) => {
        const ahora = moment();
        const estado = getEstado(record, ahora);
        
        return (
          <Badge
            status={estado.status}
            text={
              <Space>
                <span style={{ color: estado.color }}>{estado.texto}</span>
                {record.bloqueo?.bloqueado && (
                  <Tooltip title={record.bloqueo.razon}>
                    <WarningOutlined style={{ color: '#ff4d4f' }} />
                  </Tooltip>
                )}
              </Space>
            }
          />
        );
      }
    }
  ];

  const getEstado = (record, ahora) => {
    if (record.bloqueo?.bloqueado) {
      return { 
        status: 'error',
        color: '#ff4d4f',
        texto: 'Bloqueado'
      };
    }

    if (!record.proximaEjecucion) {
      return {
        status: 'default',
        color: '#d9d9d9',
        texto: 'No programado'
      };
    }

    if (record.proximaEjecucion.isBefore(ahora)) {
      return {
        status: 'warning',
        color: '#faad14',
        texto: 'Vencido'
      };
    }

    if (record.proximaEjecucion.isSame(ahora, 'day')) {
      return {
        status: 'processing',
        color: '#1890ff',
        texto: 'Hoy'
      };
    }

    return {
      status: 'success',
      color: '#52c41a',
      texto: 'Próximo'
    };
  };

  const handleErrorCardClick = () => {
    setErrorModalVisible(true);
  };

  const handleSitiosSinScheduleClick = () => {
    setSitiosSinScheduleModalVisible(true);
  };

  const renderErrorModal = () => {
    const schedulesWithErrors = schedule.filter(s => s.intentosFallidos > 0);
    
    return (
      <Modal
        title={<span><WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />Schedules con Errores</span>}
        open={errorModalVisible}
        onCancel={() => setErrorModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setErrorModalVisible(false)}>
            Cerrar
          </Button>
        ]}
        width={700}
      >
        {schedulesWithErrors.length > 0 ? (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {schedulesWithErrors.map((s, index) => (
              <Card key={s._id} style={{ marginBottom: 16 }} size="small">
                <div>
                  <Text strong>ID: </Text>
                  <Text code>{s._id}</Text>
                </div>
                <div>
                  <Text strong>Sitio: </Text>
                  <Text>{s.sitioNombre}</Text>
                </div>
                <div>
                  <Text strong>Intentos fallidos: </Text>
                  <Text type="danger">{s.intentosFallidos}</Text>
                </div>
                {s.ultimoError && (
                  <div>
                    <Text strong>Último error: </Text>
                    <Text type="danger">{s.ultimoError.mensaje}</Text>
                  </div>
                )}
                {s.bloqueo?.bloqueado && (
                  <div>
                    <Text strong>Razón de bloqueo: </Text>
                    <Text type="danger">{s.bloqueo.razon}</Text>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Empty description="No hay schedules con errores" />
        )}
      </Modal>
    );
  };

  const renderSitiosSinScheduleModal = () => {
    return (
      <Modal
        title={<span><ExclamationCircleOutlined style={{ color: '#1890ff', marginRight: 8 }} />Sitios sin Schedule</span>}
        open={sitiosSinScheduleModalVisible}
        onCancel={() => setSitiosSinScheduleModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSitiosSinScheduleModalVisible(false)}>
            Cerrar
          </Button>
        ]}
        width={700}
      >
        {estadisticas.sitiosSinSchedule.length > 0 ? (
          <List
            dataSource={estadisticas.sitiosSinSchedule}
            renderItem={site => (
              <List.Item>
                <Space>
                  <Text 
                    style={{ 
                      cursor: 'pointer', 
                      color: '#1890ff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onClick={() => handleCopyId(site._id, site.nombre)}
                  >
                    {site.nombre}
                    <CopyOutlined style={{ fontSize: '14px' }} />
                  </Text>
                  {site.url && (
                    <Text type="secondary">({site.url})</Text>
                  )}
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="Todos los sitios tienen schedule configurado" />
        )}
      </Modal>
    );
  };

  const renderEstadisticas = () => (
    <Row gutter={[16, 16]} className="mb-6">
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="Total Schedules"
            value={estadisticas.total}
            prefix={<CalendarOutlined />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="Programados Hoy"
            value={estadisticas.programadosHoy}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card 
          hoverable
          onClick={handleErrorCardClick}
          style={{ cursor: 'pointer' }}
        >
          <Statistic
            title="Schedules con Errores"
            value={schedule.filter(s => s.intentosFallidos > 0).length}
            prefix={<WarningOutlined />}
            suffix={`/ ${estadisticas.total}`}
            valueStyle={{ color: '#faad14' }}
          />
          <Text type="secondary">
            {schedule.filter(s => s.bloqueo?.bloqueado).length} bloqueados
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card 
          hoverable
          onClick={handleSitiosSinScheduleClick}
          style={{ cursor: 'pointer' }}
        >
          <Statistic
            title="Sitios sin Schedule"
            value={estadisticas.sitiosSinSchedule.length}
            prefix={<ExclamationCircleOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
          <Text type="secondary">
            Click para ver detalles
          </Text>
        </Card>
      </Col>
    </Row>
  );

  return (
    <AuthWrapper>
      <div style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2} style={{ color: '#fff', margin: 0 }}>
              Horario de Scraping
            </Title>
            <Space>
              <Button
                type="primary"
                onClick={() => setMostrarAnteriores(!mostrarAnteriores)}
              >
                {mostrarAnteriores ? 'Ver Próximos' : 'Ver Anteriores'}
              </Button>
              <Tooltip title="Actualizar">
                <Button
                  icon={<ReloadOutlined spin={actualizando} />}
                  onClick={handleRefresh}
                />
              </Tooltip>
            </Space>
          </div>

          {renderEstadisticas()}
          {renderErrorModal()}
          {renderSitiosSinScheduleModal()}
          
          {error && (
            <Alert
              message="Error al cargar datos"
              description={error}
              type="error"
              showIcon
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
              pagination={{ 
                responsive: true,
                showSizeChanger: true, 
                showQuickJumper: true,
                pageSize: 10
              }}
              scroll={{ x: 'max-content' }}
            />
          ) : (
            <Empty description={
              mostrarAnteriores ? 
                "No hay scrapings anteriores" : 
                "No hay scrapings programados"
            } />
          )}
        </Space>
      </div>
    </AuthWrapper>
  );
};

export default ScrapingSchedule;
