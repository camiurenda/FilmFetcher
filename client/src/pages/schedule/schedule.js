import React, { useEffect, useState } from 'react';
import { Table, Typography, Spin, message, Empty, Alert, Button, Space } from 'antd';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import API_URL from '../../config/api';
import moment from 'moment';

const { Title } = Typography;

const ScrapingSchedule = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Solicitando schedules a:', `${API_URL}/api/scraping-schedule`);
      const response = await axios.get(`${API_URL}/api/scraping-schedule`);
      
      const ahora = moment();
      const schedules = response.data
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

      console.log(`Encontrados ${schedules.length} schedules ${mostrarAnteriores ? 'anteriores' : 'futuros'}`);
      setSchedule(schedules);
    } catch (error) {
      console.error('Error al cargar schedules:', error);
      setError(error.response?.data?.message || 'Error al cargar el horario de scraping');
      message.error('Error al cargar el horario de scraping');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [mostrarAnteriores]);

  const columns = [
    {
      title: 'Nombre del Sitio',
      dataIndex: 'sitioNombre',
      key: 'sitioNombre'
    },
    {
      title: 'Frecuencia',
      dataIndex: 'tipoFrecuencia',
      key: 'tipoFrecuencia',
      render: (tipoFrecuencia) => tipoFrecuencia.charAt(0).toUpperCase() + tipoFrecuencia.slice(1)
    },
    {
      title: 'Último Scraping',
      key: 'ultimaEjecucion',
      render: (_, record) => (
        record.ultimaEjecucion ? (
          <Space>
            <span>{record.ultimaEjecucion.format('DD/MM/YYYY HH:mm')}</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>
              ({record.ultimaEjecucion.fromNow()})
            </span>
          </Space>
        ) : 'Nunca'
      ),
      sorter: (a, b) => {
        if (!a.ultimaEjecucion || !b.ultimaEjecucion) return 0;
        return a.ultimaEjecucion.diff(b.ultimaEjecucion);
      }
    },
    {
      title: 'Próximo Scraping',
      key: 'proximaEjecucion',
      render: (_, record) => (
        record.proximaEjecucion ? (
          <Space>
            <span>{record.proximaEjecucion.format('DD/MM/YYYY HH:mm')}</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>
              ({record.proximaEjecucion.fromNow()})
            </span>
          </Space>
        ) : 'No programado'
      ),
      sorter: (a, b) => {
        if (!a.proximaEjecucion || !b.proximaEjecucion) return 0;
        return a.proximaEjecucion.diff(b.proximaEjecucion);
      },
      defaultSortOrder: 'ascend'
    },
    {
      title: 'Estado',
      key: 'estado',
      render: (_, record) => {
        const ahora = moment();
        let color = 'default';
        let texto = 'No programado';

        if (record.proximaEjecucion) {
          if (record.proximaEjecucion.isBefore(ahora)) {
            color = 'red';
            texto = 'Vencido';
          } else if (record.proximaEjecucion.isSame(ahora, 'day')) {
            color = 'green';
            texto = 'Hoy';
          } else {
            color = 'blue';
            texto = 'Próximo';
          }
        }

        return (
          <span style={{ color: getColorByStatus(color) }}>
            {texto}
          </span>
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
          <Title level={2} style={{ color: '#fff', marginBottom: '24px' }}>
            Horario de Scraping
          </Title>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <Button
              type="primary"
              onClick={() => setMostrarAnteriores(!mostrarAnteriores)}
            >
              {mostrarAnteriores ? 'Ver Próximos Scrapings' : 'Ver Scrapings Anteriores'}
            </Button>
          </div>
          
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