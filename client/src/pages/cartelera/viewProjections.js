import React, { useEffect, useState } from 'react';
import { Table, Space, Typography, Button, Modal, message, Form, Input, DatePicker, InputNumber, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import moment from 'moment';

const { Title } = Typography;
const { confirm } = Modal;

const ViewProjections = () => {
  const [projections, setProjections] = useState([]);
  const [editingProjection, setEditingProjection] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isManualLoadModalVisible, setIsManualLoadModalVisible] = useState(false);
  const [sitiosManual, setSitiosManual] = useState([]);
  const [manualLoadForm] = Form.useForm();
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchProjections = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/projections');
      setProjections(response.data);
    } catch (error) {
      console.error('Error fetching projections:', error);
      message.error('Error al cargar las proyecciones');
    }
  };

  useEffect(() => {
    fetchProjections();
    fetchSitiosManual();
  }, []);

  const handleDisable = async (id) => {
    confirm({
      title: '¿Estás seguro de que quieres deshabilitar esta proyección?',
      content: 'Esta acción ocultará la proyección de la cartelera principal.',
      onOk: async () => {
        try {
          await axios.put(`http://localhost:5000/api/projections/disable/${id}`);
          message.success('Proyección deshabilitada correctamente');
          setProjections(projections.filter(projection => projection._id !== id));
        } catch (error) {
          console.error('Error disabling projection:', error);
          message.error('Error al deshabilitar la proyección');
        }
      },
    });
  };

  const showManualLoadModal = () => {
    manualLoadForm.resetFields();
    setIsManualLoadModalVisible(true);
  };

  const handleManualLoad = async (values) => {
    try {
      const response = await axios.post('http://localhost:5000/api/projections/load-from-image', {
        imageUrl: values.imageUrl,
        sitioId: values.sitioId
      });
      message.success('Proyecciones cargadas correctamente desde la imagen');
      setIsManualLoadModalVisible(false);
      fetchProjections(); // Actualizar la lista de proyecciones
    } catch (error) {
      console.error('Error al cargar proyecciones desde imagen:', error);
      message.error('Error al cargar proyecciones desde la imagen');
    }
  };

  const fetchSitiosManual = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/sites/manual');
      setSitiosManual(response.data);
    } catch (error) {
      console.error('Error fetching sitios manuales:', error);
      message.error('Error al cargar los sitios de carga manual');
    }
  };

  const showEditModal = (record) => {
    setEditingProjection(record);
    form.setFieldsValue({
      ...record,
      fechaHora: moment(record.fechaHora),
    });
    setIsEditModalVisible(true);
  };

  const showAddModal = () => {
    form.resetFields();
    setIsAddModalVisible(true);
  };

  const handleEdit = async (values) => {
    try {
      const response = await axios.put(`http://localhost:5000/api/projections/${editingProjection._id}`, {
        ...values,
        fechaHora: values.fechaHora.toISOString(),
      });
      message.success('Proyección actualizada correctamente');
      setIsEditModalVisible(false);
      setProjections(projections.map(p => p._id === editingProjection._id ? response.data : p));
    } catch (error) {
      console.error('Error updating projection:', error);
      message.error('Error al actualizar la proyección');
    }
  };

  const handleAdd = async (values) => {
    try {
      const response = await axios.post('http://localhost:5000/api/projections/add', {
        ...values,
        fechaHora: values.fechaHora.toISOString(),
      });
      message.success('Proyección agregada correctamente');
      setIsAddModalVisible(false);
      setProjections([...projections, response.data]);
    } catch (error) {
      console.error('Error adding projection:', error);
      message.error('Error al agregar la proyección');
    }
  };

  const columns = [
    {
      title: 'Película',
      dataIndex: 'nombrePelicula',
      key: 'nombrePelicula',
    },
    {
      title: 'Fecha y Hora',
      dataIndex: 'fechaHora',
      key: 'fechaHora',
      render: (fechaHora) => moment(fechaHora).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Cine',
      dataIndex: ['sitio', 'nombre'],
      key: 'cine',
    },
    {
      title: 'Sala',
      dataIndex: 'sala',
      key: 'sala',
    },
    {
      title: 'Duración',
      dataIndex: 'duracion',
      key: 'duracion',
      render: (duracion) => `${duracion} min`,
    },
    {
      title: 'Precio',
      dataIndex: 'precio',
      key: 'precio',
      render: (precio) => `$${precio.toFixed(2)}`,
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
        <Title level={2} style={{ color: '#fff', marginBottom: '24px' }}>Cartelera</Title>

        <div style={{ position: 'relative' }}>
          <Button
            type="primary"
            onClick={showAddModal}
            style={{
              position: 'absolute',
              top: '-50px',
              right: '120px',
              zIndex: 1
            }}
          >
            Agregar Proyección
          </Button>
          <Button
            type="primary"
            onClick={showManualLoadModal}
            style={{
              position: 'absolute',
              top: '-50px',
              right: '0',
              zIndex: 1
            }}
          >
            Carga Manual desde Imagen
          </Button>

          <Table
            columns={columns}
            dataSource={projections}
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
          title="Editar Proyección"
          open={isEditModalVisible}
          onCancel={() => setIsEditModalVisible(false)}
          footer={null}
        >
          <Form
            form={form}
            onFinish={handleEdit}
            layout="vertical"
          >
            {/* ... (form items remain the same) */}
          </Form>
        </Modal>

        <Modal
          title="Agregar Proyección"
          visible={isAddModalVisible}
          onCancel={() => setIsAddModalVisible(false)}
          footer={null}
        >
          <Form
            form={form}
            onFinish={handleAdd}
            layout="vertical"
          >
            <Form.Item name="nombrePelicula" label="Nombre de la Película" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="fechaHora" label="Fecha y Hora" rules={[{ required: true }]}>
              <DatePicker showTime format="YYYY-MM-DD HH:mm" />
            </Form.Item>
            <Form.Item name="director" label="Director" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="genero" label="Género" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="duracion" label="Duración (minutos)" rules={[{ required: true }]}>
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="sala" label="Sala" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="precio" label="Precio" rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Agregar Proyección
              </Button>
            </Form.Item>
          </Form>
        </Modal>
        <Modal
        title="Carga Manual desde Imagen"
        visible={isManualLoadModalVisible}
        onCancel={() => setIsManualLoadModalVisible(false)}
        footer={null}
      >
        <Form
          form={manualLoadForm}
          onFinish={handleManualLoad}
          layout="vertical"
        >
          <Form.Item 
            name="imageUrl" 
            label="URL de la Imagen" 
            rules={[{ required: true, message: 'Por favor ingrese la URL de la imagen' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item 
            name="sitioId" 
            label="Sitio" 
            rules={[{ required: true, message: 'Por favor seleccione el sitio' }]}
          >
            <Select>
              {sitiosManual.map(sitio => (
                <Select.Option key={sitio._id} value={sitio._id}>{sitio.nombre}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Cargar Proyecciones desde Imagen
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      </div>
    </AuthWrapper>
  );
};

export default ViewProjections;