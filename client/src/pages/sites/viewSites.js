import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Typography, Button, Modal, message, Form, Input, Select } from 'antd';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;
const { confirm } = Modal;

const ViewSite = () => {
  const [sites, setSites] = useState([]);
  const [editingSite, setEditingSite] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [editingTipoCarga, setEditingTipoCarga] = useState('scraping');

  const fetchSites = async () => {
    try {
      console.log('Iniciando fetchSites...');
      const response = await axios.get('http://localhost:5000/api/sites');
      console.log('Respuesta del servidor:', response.data);

      // Asegúrate de que todos los sitios tengan un valor válido para tipoCarga
      const sitesWithDefaultTipoCarga = response.data.map(site => ({
        ...site,
        tipoCarga: site.tipoCarga || 'N/A'
      }));

      console.log('Sitios procesados:', sitesWithDefaultTipoCarga);
      setSites(sitesWithDefaultTipoCarga);
    } catch (error) {
      console.error('Error en fetchSites:', error);
      message.error('Error al cargar los sitios. Por favor, intenta de nuevo más tarde.');
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
          await axios.put(`http://localhost:5000/api/sites/disable/${id}`);
          message.success('Sitio deshabilitado correctamente');
          setSites(sites.filter(site => site._id !== id));
        } catch (error) {
          console.error('Error disabling site:', error);
          message.error('Error al deshabilitar el sitio');
        }
      },
    });
  };

  const showEditModal = (record) => {
    setEditingSite(record);
    setEditingTipoCarga(record.tipoCarga || 'scraping');
    form.setFieldsValue({
      ...record,
      tipoCarga: record.tipoCarga || 'scraping',
    });
    setIsEditModalVisible(true);
  };

  const showAddModal = () => {
    form.resetFields();
    form.setFieldsValue({ usuarioCreador: user.email });
    setIsAddModalVisible(true);
  };

  const handleEdit = async (values) => {
    try {
      const updatedValues = { ...values };
      if (updatedValues.tipoCarga === 'manual') {
        delete updatedValues.frecuenciaActualizacion;
      }
      const response = await axios.put(`http://localhost:5000/api/sites/${editingSite._id}`, {
        ...updatedValues,
        activoParaScraping: updatedValues.tipoCarga === 'scraping'
      });
      message.success('Sitio actualizado correctamente');
      setIsEditModalVisible(false);
      setSites(sites.map(s => s._id === editingSite._id ? response.data : s));
    } catch (error) {
      console.error('Error updating site:', error);
      message.error('Error al actualizar el sitio');
    }
  };

  const handleAdd = async (values) => {
    try {
      const response = await axios.post('http://localhost:5000/api/sites/add', values);
      message.success('Sitio agregado correctamente');
      setIsAddModalVisible(false);
      setSites([...sites, response.data]);
    } catch (error) {
      console.error('Error adding site:', error);
      message.error('Error al agregar el sitio');
    }
  };

  const onEditTipoCargaChange = (value) => {
    setEditingTipoCarga(value);
    if (value === 'manual') {
      form.setFieldsValue({ frecuenciaActualizacion: undefined });
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
            {tipo ? tipo.toUpperCase() : 'N/A'}
          </Tag>
        );
      },
    },
    {
      title: 'Tipo de Carga',
      dataIndex: 'tipoCarga',
      key: 'tipoCarga',
      render: (tipoCarga) => {
        // Manejo seguro de tipoCarga
        const tipo = (tipoCarga && typeof tipoCarga === 'string') ? tipoCarga.trim() : 'N/A';
        let color = 'default';
        if (tipo.toLowerCase() === 'scraping') {
          color = 'blue';
        } else if (tipo.toLowerCase() === 'manual') {
          color = 'green';
        }
        return (
          <Tag color={color}>
            {tipo.toUpperCase()}
          </Tag>
        );
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
          <Button size="small" onClick={() => showEditModal(record)}>Editar</Button>
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
            onClick={showAddModal}
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

        <Modal
          title="Editar Sitio"
          visible={isEditModalVisible}
          onCancel={() => setIsEditModalVisible(false)}
          footer={null}
        >
          <Form
            form={form}
            onFinish={handleEdit}
            layout="vertical"
          >
            <Form.Item name="nombre" label="Nombre del sitio web" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="url" label="URL del sitio web" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="direccion" label="Dirección">
              <Input />
            </Form.Item>
            <Form.Item name="tipo" label="Tipo">
              <Select>
                <Select.Option value="cine">Cine</Select.Option>
                <Select.Option value="teatro">Teatro</Select.Option>
                <Select.Option value="museo">Museo</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="tipoCarga" label="Tipo de Carga" rules={[{ required: true }]}>
              <Select onChange={onEditTipoCargaChange}>
                <Select.Option value="scraping">Scraping</Select.Option>
                <Select.Option value="manual">Carga Manual</Select.Option>
              </Select>
            </Form.Item>
            {editingTipoCarga === 'scraping' && (
              <Form.Item
                name="frecuenciaActualizacion"
                label="Frecuencia de Actualización"
                rules={[{ required: true, message: 'Por favor seleccione la frecuencia de actualización' }]}
              >
                <Select>
                  <Select.Option value="diaria">Diaria</Select.Option>
                  <Select.Option value="semanal">Semanal</Select.Option>
                  <Select.Option value="mensual">Mensual</Select.Option>
                  <Select.Option value="test">Test</Select.Option>
                </Select>
              </Form.Item>
            )}
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Actualizar Sitio
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Agregar Sitio"
          open={isAddModalVisible}
          onCancel={() => setIsAddModalVisible(false)}
          footer={null}
        >
          <Form
            form={form}
            onFinish={handleAdd}
            layout="vertical"
          >
            <Form.Item name="nombre" label="Nombre del sitio web" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="url" label="URL del sitio web" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="direccion" label="Dirección">
              <Input />
            </Form.Item>
            <Form.Item name="tipo" label="Tipo">
              <Select>
                <Select.Option value="cine">Cine</Select.Option>
                <Select.Option value="teatro">Teatro</Select.Option>
                <Select.Option value="museo">Museo</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="tipoCarga" label="Tipo de Carga" rules={[{ required: true }]}>
              <Select onChange={(value) => form.setFieldsValue({ frecuenciaActualizacion: value === 'manual' ? undefined : form.getFieldValue('frecuenciaActualizacion') })}>
                <Select.Option value="scraping">Scraping</Select.Option>
                <Select.Option value="manual">Carga Manual</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.tipoCarga !== currentValues.tipoCarga}
            >
              {({ getFieldValue }) =>
                getFieldValue('tipoCarga') === 'scraping' && (
                  <Form.Item
                    name="frecuenciaActualizacion"
                    label="Frecuencia de Actualización"
                    rules={[{ required: true, message: 'Por favor seleccione la frecuencia de actualización' }]}
                  >
                    <Select>
                      <Select.Option value="diaria">Diaria</Select.Option>
                      <Select.Option value="semanal">Semanal</Select.Option>
                      <Select.Option value="mensual">Mensual</Select.Option>
                      <Select.Option value="test">Test</Select.Option>
                    </Select>
                  </Form.Item>
                )
              }
            </Form.Item>
            <Form.Item name="usuarioCreador" label="Usuario Creador" rules={[{ required: true }]}>
              <Input disabled />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Agregar Sitio
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AuthWrapper>
  );
};

export default ViewSite;