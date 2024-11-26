import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Typography, Button, Modal, message, Spin } from 'antd';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import { useAuth } from '../../hooks/useAuth';
import SiteModal from './siteModal';
import siteService from '../../service/site.service';
import API_URL from '../../config/api';
import moment from 'moment';

const { Title } = Typography;
const { confirm } = Modal;

const ViewSite = () => {
  const [sites, setSites] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [editingSite, setEditingSite] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const { user, isAuthenticated, isLoading } = useAuth();

  const fetchData = async () => {
    try {
      const [sitesResponse, schedulesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/sites`),
        axios.get(`${API_URL}/api/scraping-schedule`)
      ]);

      const sitesData = Array.isArray(sitesResponse.data) ? sitesResponse.data : [];
      const schedulesData = Array.isArray(schedulesResponse.data) ? schedulesResponse.data : [];

      const sitesWithSchedules = sitesData.map(site => {
        const schedule = schedulesData.find(sch => sch.sitioId === site._id);
        return {
          ...site,
          schedule
        };
      });

      setSites(sitesWithSchedules);
      setSchedules(schedulesData);
    } catch (error) {
      console.error('Error al obtener datos:', error);
      message.error('Error al cargar los datos');
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchData();
    }
  }, [isAuthenticated, user]);

  const formatFrecuencia = (site) => {
    if (site.tipoCarga !== 'scraping') return '-';
    
    const schedule = site.schedule;
    if (!schedule) return 'No configurado';

    const hora = schedule.hora;
    
    switch (schedule.tipoFrecuencia) {
      case 'diaria':
        return `Diariamente a las ${hora}`;
      case 'semanal':
        const dias = schedule.diasSemana
          .map(dia => moment().day(dia).format('dddd'))
          .join(', ');
        return `${dias} a las ${hora}`;
      case 'mensual-dia':
        return `Día ${schedule.diaMes} de cada mes a las ${hora}`;
      case 'mensual-posicion':
        const diaSemana = moment().day(schedule.diaSemana).format('dddd');
        return `${schedule.semanaMes} ${diaSemana} del mes a las ${hora}`;
      default:
        return schedule.tipoFrecuencia;
    }
  };

  const handleDisable = async (id) => {
    confirm({
      title: '¿Estás seguro de que quieres deshabilitar este sitio?',
      content: 'Esta acción ocultará el sitio de la lista principal y lo desactivará para el scraping.',
      onOk: async () => {
        try {
          await axios.put(`${API_URL}/api/sites/disable/${id}`);
          message.success('Sitio deshabilitado correctamente');
          fetchData();
        } catch (error) {
          console.error('Error al deshabilitar el sitio:', error);
          message.error('Error al deshabilitar el sitio');
        }
      },
    });
  };

  const handleSubmit = async (values) => {
    if (!user?.email) {
      message.error('Error de autenticación');
      return;
    }

    setLoading(true);
    try {
      if (editingSite) {
        await siteService.actualizarSitio(editingSite._id, values);
        message.success('Sitio actualizado correctamente');
      } else {
        await siteService.agregarSitio({
          ...values,
          usuarioCreador: user.email
        });
        message.success('Sitio agregado correctamente');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Error en operación:', error);
      message.error(
        error.response?.data?.message || 
        'Error al procesar la operación'
      );
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
    },
    {
      title: 'Dirección',
      dataIndex: 'direccion',
      key: 'direccion',
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      render: (tipo) => {
        const colors = {
          cine: 'purple',
          teatro: 'orange',
          museo: 'cyan'
        };
        return (
          <Tag color={colors[tipo] || 'geekblue'}>
            {tipo?.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Tipo de Carga',
      dataIndex: 'tipoCarga',
      key: 'tipoCarga',
      render: (tipoCarga) => (
        <Tag color={tipoCarga === 'scraping' ? 'blue' : 'green'}>
          {(tipoCarga || 'N/A').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Frecuencia',
      dataIndex: 'tipoFrecuencia',
      key: 'tipoFrecuencia',
      render: (_, record) => formatFrecuencia(record),
    },
    {
      title: 'Estado',
      dataIndex: 'habilitado',
      key: 'habilitado',
      render: (habilitado) => (
        <Tag color={habilitado ? 'green' : 'red'}>
          {habilitado ? 'Activo' : 'Inactivo'}
        </Tag>
      ),
    },
    {
      title: 'Fecha Creación',
      dataIndex: 'fechaCreacion',
      key: 'fechaCreacion',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Acciones',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            onClick={() => {
              setEditingSite(record);
              setModalVisible(true);
            }}
          >
            Editar
          </Button>
          <Button 
            size="small" 
            danger 
            onClick={() => handleDisable(record._id)}
          >
            Deshabilitar
          </Button>
        </Space>
      ),
    },
  ];

  if (isLoading || pageLoading) {
    return (
      <AuthWrapper>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Spin size="large" />
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <div className="p-6 bg-gray-900 rounded-lg">
        <div className="mb-6 flex justify-between items-center">
          <Title level={2} className="text-white m-0">
            Gestión de Sitios
          </Title>
          <Button 
            type="primary"
            onClick={() => {
              setEditingSite(null);
              setModalVisible(true);
            }}
          >
            Agregar Sitio
          </Button>
        </div>

        <Table 
          columns={columns} 
          dataSource={sites} 
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          pagination={{ 
            responsive: true,
            showSizeChanger: true, 
            showQuickJumper: true,
          }}
        />

        <SiteModal
          visible={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            setEditingSite(null);
          }}
          onSubmit={handleSubmit}
          initialValues={editingSite || { usuarioCreador: user?.email }}
          loading={loading}
          title={editingSite ? 'Editar Sitio' : 'Agregar Sitio'}
        />
      </div>
    </AuthWrapper>
  );
};

export default ViewSite;