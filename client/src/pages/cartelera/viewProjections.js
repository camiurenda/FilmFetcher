import React, { useEffect, useState } from 'react';
import { Table, Space, Typography, Button, Modal, message, Form, Input, DatePicker, InputNumber, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import moment from 'moment';
import AddProjectionModal from './addProjections'; // Asegúrate de que la ruta sea correcta

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
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);

  const fetchProjections = async () => {
    try {
      const endpoint = mostrarAnteriores ? '/api/projections/proyecciones-anteriores' : '/api/projections/proyecciones-actuales';
      const response = await axios.get(`http://localhost:5000${endpoint}`);
      setProjections(response.data);
    } catch (error) {
      console.error('Error fetching projections:', error);
      message.error('Error al cargar las proyecciones');
    }
  };

  useEffect(() => {
    fetchProjections();
    fetchSitiosManual();
  }, [mostrarAnteriores]);

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
      fetchProjections();
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
      const response = await axios.post('http://localhost:5000/api/projections/add', values);
      message.success('Proyección agregada correctamente');
      setIsAddModalVisible(false);
      setProjections([...projections, response.data]);
    } catch (error) {
      console.error('Error adding projection:', error);
      message.error('Error al agregar la proyección');
    }
  };

  const handleExportCSV = (tipo) => {
    axios.get(`http://localhost:5000/api/projections/exportar-csv?tipo=${tipo}`, {
      responseType: 'blob',
    })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `cartelera_${tipo}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((error) => {
        console.error('Error al exportar CSV:', error);
        message.error('Error al exportar la cartelera a CSV');
      });
  };

  const showExportModal = () => {
    confirm({
      title: '¿Qué tipo de exportación deseas realizar?',
      content: 'Puedes exportar solo las proyecciones actuales o todas las proyecciones.',
      okText: 'Exportar Actual',
      cancelText: 'Exportar Todo',
      onOk() {
        handleExportCSV('actual');
      },
      onCancel() {
        handleExportCSV('completo');
      },
      cancelButtonProps: { style: { display: 'inline-block' } },
      okButtonProps: { style: { display: 'inline-block' } },
      closable: true,
      maskClosable: true,
      footer: (_, { OkBtn, CancelBtn }) => (
        <>
          <Button onClick={() => Modal.destroyAll()}>Cerrar</Button>
          <OkBtn />
          <CancelBtn />
        </>
      ),
    });
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
      title: 'Director',
      dataIndex: 'director',
      key: 'director',
    },
    {
      title: 'Género',
      dataIndex: 'genero',
      key: 'genero',
    },
    {
      title: 'Duración',
      dataIndex: 'duracion',
      key: 'duracion',
      render: (duracion) => `${duracion} min`,
    },
    {
      title: 'Sala',
      dataIndex: 'sala',
      key: 'sala',
    },
    {
      title: 'Precio',
      dataIndex: 'precio',
      key: 'precio',
      render: (precio) => `$${precio.toFixed(2)}`,
    },
    {
      title: 'Vigencia',
      key: 'estado',
      render: (_, record) => {
        const ahora = moment();
        const fechaProyeccion = moment(record.fechaHora);
        if (fechaProyeccion.isBefore(ahora)) {
          return <span style={{ color: 'red' }}>Finalizada</span>;
        } else if (fechaProyeccion.isSame(ahora, 'day')) {
          return <span style={{ color: 'green' }}>Hoy</span>;
        } else {
          return <span style={{ color: 'blue' }}>Próxima</span>;
        }
      },
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
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          marginBottom: '20px', 
          gap: '10px'
        }}>
          <Button
            type="primary"
            onClick={() => setMostrarAnteriores(!mostrarAnteriores)}
          >
            {mostrarAnteriores ? 'Ver Proyecciones Actuales' : 'Ver Proyecciones Anteriores'}
          </Button>
          <Button type="primary" onClick={showAddModal}>
            Agregar
          </Button>
          <Button type="primary" onClick={showManualLoadModal}>
            Carga Manual desde Imagen
          </Button>
          <Button type="primary" onClick={showExportModal}>
            Exportar a CSV
          </Button>
        </div>

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
            <Form.Item name="nombrePelicula" label="Nombre de la Película" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="fechaHora" label="Fecha y Hora" rules={[{ required: true }]}>
              <DatePicker showTime format="YYYY-MM-DD HH:mm" />
            </Form.Item>
            <Form.Item name="director" label="Director">
              <Input />
            </Form.Item>
            <Form.Item name="genero" label="Género">
              <Input />
            </Form.Item>
            <Form.Item name="duracion" label="Duración (minutos)">
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="sala" label="Sala" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="precio" label="Precio">
              <InputNumber min={0} step={0.01} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Actualizar Proyección
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <AddProjectionModal
          isVisible={isAddModalVisible}
          onCancel={() => setIsAddModalVisible(false)}
          onAdd={handleAdd}
        />

        <Modal
          title="Carga Manual desde Imagen"
          open={isManualLoadModalVisible}
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