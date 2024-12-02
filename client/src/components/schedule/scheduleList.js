import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Typography, Card, Tooltip, Modal, Badge } from 'antd';
import { 
  PauseCircleOutlined, 
  PlayCircleOutlined, 
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  WarningOutlined
} from '@ant-design/icons';
import moment from 'moment';
import axios from 'axios';
import API_URL from '../../config/api';

const { Text, Title } = Typography;
const { confirm } = Modal;

const ajustarHora = (fecha) => {
  if (!fecha) return null;
  const fechaMoment = moment(fecha);
  // En producción no ajustamos nada, en desarrollo restamos 3 horas
  if (process.env.NODE_ENV !== 'production') {
    fechaMoment.subtract(3, 'hours');
  }
  return fechaMoment;
};

const ScheduleList = ({ onEditSchedule }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estadoCola, setEstadoCola] = useState(null);

  const cargarSchedules = async () => {
    try {
      const [schedulesResponse, colaResponse] = await Promise.all([
        axios.get(`${API_URL}/api/scraping-schedule`),
        axios.get(`${API_URL}/api/scraping-schedule/cola/estado`)
      ]);

      const schedulesAjustados = schedulesResponse.data.map(schedule => ({
        ...schedule,
        proximaEjecucion: ajustarHora(schedule.proximaEjecucion),
        ultimaEjecucion: ajustarHora(schedule.ultimaEjecucion)
      }));

      setSchedules(schedulesAjustados);
      setEstadoCola({
        ...colaResponse.data,
        proximaEjecucion: ajustarHora(colaResponse.data.proximaEjecucion)
      });
    } catch (error) {
      console.error('Error al cargar schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSchedules();
    // Actualizar cada minuto
    const intervalo = setInterval(cargarSchedules, 60000);
    return () => clearInterval(intervalo);
  }, []);

  const formatearFrecuencia = (schedule) => {
    if (!schedule.configuraciones || schedule.configuraciones.length === 0) {
      return 'Sin configuración';
    }

    // Tomamos la primera configuración como referencia
    const config = schedule.configuraciones[0];
    const hora = moment(config.hora, 'HH:mm').format('HH:mm');
    
    switch (schedule.tipoFrecuencia) {
      case 'unica':
        return `Una vez a las ${hora}`;
      case 'diaria':
        return `Diariamente a las ${hora}`;
      case 'semanal':
        const dias = config.diasSemana
          .map(dia => moment().day(dia).format('dddd'))
          .join(', ');
        return `${dias} a las ${hora}`;
      case 'mensual-dia':
        const diasMes = config.diasMes.join(', ');
        return `Día${config.diasMes.length > 1 ? 's' : ''} ${diasMes} de cada mes a las ${hora}`;
      case 'mensual-posicion':
        const diaSemana = moment().day(config.diaSemana).format('dddd');
        return `${config.semanaMes} ${diaSemana} del mes a las ${hora}`;
      default:
        return 'Configuración inválida';
    }
  };

  const confirmarAccion = (titulo, mensaje, onOk) => {
    confirm({
      title: titulo,
      content: mensaje,
      onOk,
      okText: 'Confirmar',
      cancelText: 'Cancelar',
      okType: 'danger'
    });
  };

  const pausarSchedule = async (scheduleId) => {
    try {
      await axios.post(`${API_URL}/api/scraping-schedule/${scheduleId}/pausar`);
      cargarSchedules();
    } catch (error) {
      console.error('Error al pausar schedule:', error);
    }
  };

  const reanudarSchedule = async (scheduleId) => {
    try {
      await axios.post(`${API_URL}/api/scraping-schedule/${scheduleId}/reanudar`);
      cargarSchedules();
    } catch (error) {
      console.error('Error al reanudar schedule:', error);
    }
  };

  const eliminarSchedule = async (scheduleId) => {
    try {
      await axios.delete(`${API_URL}/api/scraping-schedule/${scheduleId}`);
      cargarSchedules();
    } catch (error) {
      console.error('Error al eliminar schedule:', error);
    }
  };

  const columns = [
    {
      title: 'Sitio',
      dataIndex: ['sitioId', 'nombre'],
      key: 'sitio'
    },
    {
      title: 'Frecuencia',
      key: 'frecuencia',
      render: (_, record) => (
        <Space>
          <CalendarOutlined />
          <Text>{formatearFrecuencia(record)}</Text>
        </Space>
      )
    },
    {
      title: 'Próxima Ejecución',
      dataIndex: 'proximaEjecucion',
      key: 'proximaEjecucion',
      render: (fecha) => (
        <Space>
          <ClockCircleOutlined />
          <Text>{moment(fecha).format('DD/MM/YYYY HH:mm')}</Text>
          <Text type="secondary">({moment(fecha).fromNow()})</Text>
        </Space>
      ),
      sorter: (a, b) => moment(a.proximaEjecucion).unix() - moment(b.proximaEjecucion).unix()
    },
    {
      title: 'Última Ejecución',
      dataIndex: 'ultimaEjecucion',
      key: 'ultimaEjecucion',
      render: (fecha) => (
        <Space>
          <ClockCircleOutlined />
          <Text>{fecha ? moment(fecha).format('DD/MM/YYYY HH:mm') : 'Nunca'}</Text>
          {fecha && <Text type="secondary">({moment(fecha).fromNow()})</Text>}
        </Space>
      )
    },
    {
      title: 'Estado',
      key: 'estado',
      render: (_, record) => {
        const esProximo = estadoCola?.proximaEjecucion && 
                         moment(estadoCola.proximaEjecucion).isSame(record.proximaEjecucion);
        const ejecutandose = estadoCola?.jobsEnEjecucion?.some(job => job.id === record._id);

        return (
          <Space>
            {record.activo ? (
              ejecutandose ? (
                <Tag color="processing" icon={<ClockCircleOutlined spin />}>
                  Ejecutando
                </Tag>
              ) : record.bloqueo?.bloqueado ? (
                <Tag color="error" icon={<WarningOutlined />}>
                  Bloqueado
                </Tag>
              ) : (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  Activo
                </Tag>
              )
            ) : (
              <Tag color="warning" icon={<PauseCircleOutlined />}>
                Pausado
              </Tag>
            )}
            {esProximo && !ejecutandose && (
              <Badge status="processing" text="Próximo" />
            )}
          </Space>
        );
      }
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title={record.activo ? 'Pausar' : 'Reanudar'}>
            <Button
              type="text"
              icon={record.activo ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => {
                if (record.activo) {
                  confirmarAccion(
                    'Pausar Schedule',
                    '¿Estás seguro de que deseas pausar este schedule?',
                    () => pausarSchedule(record._id)
                  );
                } else {
                  confirmarAccion(
                    'Reanudar Schedule',
                    '¿Estás seguro de que deseas reanudar este schedule?',
                    () => reanudarSchedule(record._id)
                  );
                }
              }}
            />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                confirmarAccion(
                  'Eliminar Schedule',
                  '¿Estás seguro de que deseas eliminar este schedule? Esta acción no se puede deshacer.',
                  () => eliminarSchedule(record._id)
                );
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Title level={4}>
          <ClockCircleOutlined /> Schedules de Scraping
        </Title>

        {estadoCola && (
          <Card size="small">
            <Space split={<div style={{ width: 1, background: '#f0f0f0', height: 20 }} />}>
              <Text>
                <Badge status={estadoCola.jobsEnEjecucion?.length > 0 ? "processing" : "success"} />
                Estado: {estadoCola.jobsEnEjecucion?.length > 0 ? 'Ejecutando' : 'Esperando'}
              </Text>
              <Text>
                <ClockCircleOutlined style={{ marginRight: 8 }} />
                Jobs en cola: {estadoCola.jobsEnCola}
              </Text>
              {estadoCola.proximaEjecucion && (
                <Text>
                  <CalendarOutlined style={{ marginRight: 8 }} />
                  Próxima ejecución: {moment(estadoCola.proximaEjecucion).format('DD/MM/YYYY HH:mm')}
                  {' '}({moment(estadoCola.proximaEjecucion).fromNow()})
                </Text>
              )}
            </Space>
          </Card>
        )}

        <Table
          columns={columns}
          dataSource={schedules}
          rowKey="_id"
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Space>
    </Card>
  );
};

export default ScheduleList;
