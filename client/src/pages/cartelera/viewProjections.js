import React, { useEffect, useState, useCallback } from 'react';
import { Table, Space, Typography, Button, Modal, message, Form, Input, DatePicker, InputNumber, Select, Flex, Row, Col } from 'antd';
import { PoweroffOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import moment from 'moment';
import AddProjectionModal from './addProjections';
import API_URL from '../../config/api';

const { Title } = Typography;
const { confirm } = Modal;
const { Search } = Input;

const ViewProjections = () => {
  const [projections, setProjections] = useState([]);
  const [filteredProjections, setFilteredProjections] = useState([]);
  const [editingProjection, setEditingProjection] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isManualLoadModalVisible, setIsManualLoadModalVisible] = useState(false);
  const [sitiosManual, setSitiosManual] = useState([]);
  const [manualLoadForm] = Form.useForm();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  const [scrapedProjections, setScrapedProjections] = useState([]);
  const [isResultModalVisible, setIsResultModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('nombrePelicula');

  const fetchProjections = useCallback(async () => {
    try {
      const endpoint = mostrarAnteriores ? '/api/projections/proyecciones-anteriores' : '/api/projections/proyecciones-actuales';
      const response = await axios.get(`${API_URL}${endpoint}`);
      setProjections(response.data);
      setFilteredProjections(response.data);
    } catch (error) {
      console.error('Error fetching projections:', error);
      message.error('Error al cargar las proyecciones');
    }
  }, [mostrarAnteriores]);

  useEffect(() => {
    fetchProjections();
    fetchSitiosManual();
  }, [fetchProjections]);

  const handleSearch = (value) => {
    setSearchText(value);
    if (!value) {
      setFilteredProjections(projections);
      return;
    }

    const searchLower = value.toLowerCase();
    const filtered = projections.filter(projection => {
      const fieldValue = String(projection[filterType] || '').toLowerCase();
      return fieldValue.includes(searchLower);
    });
    
    setFilteredProjections(filtered);
  };

  const handleFilterTypeChange = (value) => {
    setFilterType(value);
    setSearchText('');
    setFilteredProjections(projections);
  };

  const handleDisable = async (id) => {
    confirm({
      title: '¿Estás seguro de que quieres deshabilitar esta proyección?',
      content: 'Esta acción ocultará la proyección de la cartelera principal.',
      onOk: async () => {
        try {
          await axios.put(`${API_URL}/api/projections/disable/${id}`);
          message.success('Proyección deshabilitada correctamente');
          fetchProjections();
        } catch (error) {
          console.error('Error al deshabilitar proyección:', error);
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
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/projections/load-from-file`, {
        fileUrl: values.fileUrl,
        sitioId: values.sitioId,
        fileType: values.fileType
      });
      setScrapedProjections(response.data);
      setIsManualLoadModalVisible(false);
      setIsResultModalVisible(true);
      message.success('Proyecciones cargadas correctamente desde el archivo');
    } catch (error) {
      console.error('Error al cargar proyecciones desde archivo:', error);
      message.error('Error al cargar proyecciones desde el archivo');
    }
  };

  const fetchSitiosManual = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sites/manual`);
      setSitiosManual(response.data);
    } catch (error) {
      console.error('Error fetching sitios manuales:', error);
      message.error('Error al cargar los sitios de carga manual');
    }
  };

  const handleResultModalClose = () => {
    setIsResultModalVisible(false);
    fetchProjections();
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
      await axios.put(`${API_URL}/api/projections/${editingProjection._id}`, {
        ...values,
        fechaHora: values.fechaHora.toISOString(),
      });
      message.success('Proyección actualizada correctamente');
      setIsEditModalVisible(false);
      fetchProjections();
    } catch (error) {
      console.error('Error updating projection:', error);
      message.error('Error al actualizar la proyección');
    }
  };

  const handleAdd = async (values) => {
    try {
      await axios.post(`${API_URL}/api/projections/add`, values);
      message.success('Proyección agregada correctamente');
      setIsAddModalVisible(false);
      fetchProjections();
    } catch (error) {
      console.error('Error adding projection:', error);
      message.error('Error al agregar la proyección');
    }
  };

  const handleExportCSV = (tipo) => {
    axios.get(`${API_URL}/api/projections/exportar-csv?tipo=${tipo}`, {
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
      render: (fechaHora) => moment(fechaHora).format('DD-MM-YYYY HH:mm'),
    },
    {
      title: 'Director',
      dataIndex: 'director',
      key: 'director',
    },
    {
      title: 'Duración',
      dataIndex: 'duracion',
      key: 'duracion',
      render: (duracion) => `${duracion} min`,
    },
    {
      title: 'Cine',
      dataIndex: 'nombreCine',
      key: 'nombreCine',
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
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px',
  gap: '16px'
}}>
  {/* Contenedor del buscador */}
  <div style={{ flex: '1' }}>
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={8} md={6}>
        <Select
          value={filterType}
          onChange={handleFilterTypeChange}
          style={{ width: '100%' }}
        >
          <Select.Option value="nombrePelicula">Película</Select.Option>
          <Select.Option value="genero">Género</Select.Option>
          <Select.Option value="director">Director</Select.Option>
          <Select.Option value="nombreCine">Cine</Select.Option>
        </Select>
      </Col>
      <Col xs={24} sm={16} md={18}>
        <Search
          placeholder={`Buscar por ${filterType === 'nombrePelicula' ? 'película' : 
                      filterType === 'genero' ? 'género' : 
                      filterType === 'director' ? 'director' : 'cine'}`}
          value={searchText}
          onChange={e => handleSearch(e.target.value)}
          style={{ width: '100%' }}
          allowClear
        />
      </Col>
    </Row>
  </div>

  {/* Contenedor de botones */}
  <div style={{
    display: 'flex',
    gap: '10px',
    flexWrap: 'nowrap'
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
      Carga Manual desde Archivo
    </Button>
    <Button type="primary" onClick={showExportModal}>
      Exportar a CSV
    </Button>
  </div>
</div>

        <Table
          columns={columns}
          dataSource={filteredProjections}
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
          title="Carga Manual desde Archivo"
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
              name="fileUrl"
              label="URL del Archivo"
              rules={[{ required: true, message: 'Por favor ingrese la URL del archivo' }]}
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
            <Form.Item
              name="fileType"
              label="Tipo de Archivo"
              rules={[{ required: true, message: 'Por favor seleccione el tipo de archivo' }]}
            >
              <Select>
                <Select.Option value="image">Imagen</Select.Option>
                <Select.Option value="pdf">PDF</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Flex gap="small" wrap>
                <Button
                  type="primary"
                  icon={<PoweroffOutlined />}
                  loading={loading}
                  onClick={() => manualLoadForm.submit()}
                >
                  Cargar Proyecciones desde archivo
                </Button>
              </Flex>
            </Form.Item>
          </Form>
        </Modal>
        <Modal
          title="Resultados del Scraping"
          open={isResultModalVisible}
          onCancel={handleResultModalClose}
          footer={[
            <Button key="close" onClick={handleResultModalClose}>
              Cerrar
            </Button>
          ]}
          width={1000}
        >
          <Table
            columns={columns}
            dataSource={scrapedProjections}
            rowKey={(record) => `${record.nombrePelicula}-${record.fechaHora}`}
          />
        </Modal>
      </div>
    </AuthWrapper>
  );
};

export default ViewProjections;