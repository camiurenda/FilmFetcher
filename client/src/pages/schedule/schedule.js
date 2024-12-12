import React, { useEffect, useState } from 'react';
import { Table, Typography, Spin, message, Empty, Alert, Button, Space } from 'antd';
import axios from 'axios';
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
    proximoScraping: null
  });
  const [actualizando, setActualizando] = useState(false);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [scheduleResponse, statsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/scraping-schedule`),
        axios.get(`${API_URL}/api/stats`)
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
        proximoScraping: statsResponse.data.proximoScraping
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

  const columns = [
    {
      title: 'Nombre del Sitio',
      dataIndex: 'sitioNombre',
      key: 'sitioNombre',
      fixed: 'left'
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

  const getColorByStatus = (status) => {
    const colors = {
      red: '#ff4d4f',
      green: '#52c41a',
      blue: '#1890ff',
      default: '#d9d9d9'
    };
    return colors[status] || colors.default;
  };

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