import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Typography, Button, Modal, message } from 'antd';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import API_URL from '../../config/api';
import SiteModal from './siteModal';

const { Title } = Typography;
const { confirm } = Modal;

const ViewSite = () => {
  const [sites, setSites] = useState([]);
  const [editingSite, setEditingSite] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchSites = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sites`);
      setSites(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error al obtener sitios:', error);
      message.error('Error al cargar los sitios');
      setSites([]);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleDisable = async (id) => {
    confirm({
      title: '¿Estás seguro de que quieres deshabilitar este sitio?',
      content: 'Esta acción ocultará el sitio de la lista principal y lo desactivará para el scraping.',
      onOk: async () => {
        try {
          await axios.put(`${API_URL}/api/sites/disable/${id}`);
          message.success('Sitio deshabilitado correctamente');
          fetchSites();
        } catch (error) {
          console.error('Error al deshabilitar el sitio:', error);
          message.error('Error al deshabilitar el sitio');
        }
      },
    });
  };

  const showModal = (mode, record = null) => {
    setModalMode(mode);
    setEditingSite(record);
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setEditingSite(null);
    setModalMode('add');
  };

  const handleSubmit = async (values) => {
    try {
      if (modalMode === 'edit') {
        await axios.put(`${API_URL}/api/sites/${editingSite._id}`, values);
        message.success('Sitio actualizado correctamente');
      } else {
        if (!user?.email) {
          message.error('Error: Usuario no identificado');
          return;
        }
        await axios.post(`${API_URL}/api/sites/add`, {
          ...values,
          usuarioCreador: user.email
        });
        message.success('Sitio agregado correctamente');
      }
      handleModalClose();
      fetchSites();
    } catch (error) {
      console.error('Error al procesar el sitio:', error);
      message.error('Error al procesar el sitio');
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
        if (!tipo) return <Tag color="default">No especificado</Tag>;
        
        let color = 'geekblue';
        if (tipo === 'cine') {
          color = 'purple';
        } else if (tipo === 'teatro') {
          color = 'orange';
        } else if (tipo === 'museo') {
          color = 'cyan';
        }
        return (
          <Tag color={color} key={tipo}>
            {tipo.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Tipo de Carga',
      dataIndex: 'tipoCarga',
      key: 'tipoCarga',
      render: (tipoCarga) => {
        const tipo = tipoCarga || 'N/A';
        return (
          <Tag color={tipo === 'scraping' ? 'blue' : (tipo === 'manual' ? 'green' : 'default')}>
            {tipo.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Precio',
      key: 'precio',
      render: (_, record) => {
        if (record.esGratis) {
          return <Tag color="green">GRATIS</Tag>;
        }
        return record.precioDefault ? 
          <span>${record.precioDefault.toFixed(2)}</span> : 
          <Tag color="orange">No especificado</Tag>;
      },
    },
    {
      title: 'Frecuencia de Actualización',
      dataIndex: 'frecuenciaActualizacion',
      key: 'frecuenciaActualizacion',
    },
    {
      title: 'Activo',
      dataIndex: 'habilitado',
      key: 'habilitado',
      render: (habilitado) => (
        <Tag color={habilitado ? 'green' : 'red'}>
          {habilitado ? 'Sí' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Fecha de Creación',
      dataIndex: 'fechaCreacion',
      key: 'fechaCreacion',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Acciones',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" onClick={() => showModal('edit', record)}>Editar</Button>
          <Button size="small" danger onClick={() => handleDisable(record._id)}>Deshabilitar</Button>
        </Space>
      ),
    },
  ];

  return (
    <AuthWrapper>
      <div style={{ padding: '24px', background: '#141414', borderRadius: '8px', overflow: 'auto' }}>
        <Title level={2} style={{ color: '#fff', marginBottom: '24px' }}>Ver Sitios</Title>
        
        <div style={{ position: 'relative' }}>
          <Button 
            type="primary" 
            onClick={() => showModal('add')}
            style={{
              position: 'absolute',
              top: '-50px',
              right: '0',
              zIndex: 1
            }}
          >
            Agregar Sitio
          </Button>
          
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
        </div>

        <SiteModal
          visible={isModalVisible}
          onCancel={handleModalClose}
          onSubmit={handleSubmit}
          initialValues={modalMode === 'edit' ? editingSite : { 
            tipoCarga: 'scraping',
            esGratis: false,
            usuarioCreador: user?.email || ''
          }}
          title={modalMode === 'edit' ? 'Editar Sitio' : 'Agregar Sitio'}
        />
      </div>
    </AuthWrapper>
  );
};

export default ViewSite;