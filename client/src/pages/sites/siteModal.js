import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Divider, Space, Checkbox, InputNumber, Row, Col, Collapse, Table, Tag } from 'antd';
import { SaveOutlined, LoadingOutlined, GlobalOutlined, EnvironmentOutlined } from '@ant-design/icons';
import ScrapingConfig from '../../components/schedule/scheduleConfig';
import ScrapingProgressModal from '../../components/Scrap/ScrapingProgressModal';
import moment from 'moment';
import axios from 'axios';
import API_URL from '../../config/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { Panel } = Collapse;

const SiteModal = ({ 
  visible, 
  onCancel, 
  onSubmit, 
  initialValues = {}, 
  loading = false,
  title = 'Editar Sitio'
}) => {
  console.log('🔄 SiteModal renderizado');

  const [form] = Form.useForm();
  const [tipoCarga, setTipoCarga] = useState(initialValues?.tipoCarga || 'scraping');
  const [esGratis, setEsGratis] = useState(initialValues?.esGratis || false);
  const [loadingData, setLoadingData] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [scrapingProgress, setScrapingProgress] = useState({
    visible: false,
    currentStep: 0,
    status: {},
    error: null,
    stats: { total: 0, processed: 0 }
  });
  const [scrapedProjections, setScrapedProjections] = useState([]);
  const [isResultModalVisible, setIsResultModalVisible] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      if (visible && initialValues._id) {
        try {
          setLoadingData(true);
          console.log('🔄 Cargando datos para sitio:', initialValues._id);
          
          const [sitioResponse, scheduleResponse] = await Promise.all([
            axios.get(`${API_URL}/api/sites/${initialValues._id}`),
            axios.get(`${API_URL}/api/scraping-schedule/sitio/${initialValues._id}`)
          ]);
          
          const sitioData = sitioResponse.data;
          const scheduleData = scheduleResponse.data;
  
          console.log('✅ Datos del sitio cargados:', sitioData);
          console.log('✅ Schedule encontrado:', scheduleData);
  
          setSchedule(scheduleData);

          const formData = {
            ...sitioData,
            tipoFrecuencia: scheduleData?.tipoFrecuencia,
            configuraciones: scheduleData?.configuraciones?.map(config => ({
              ...config,
              hora: config.hora ? dayjs(moment(config.hora, 'HH:mm')) : undefined,
              diasMes: config.diasMes || [],
              diasSemana: config.diasSemana || []
            })) || []
          };
  
          console.log('✅ Datos combinados para el formulario:', formData);
          form.setFieldsValue(formData);
  
          setTipoCarga(sitioData.tipoCarga || 'scraping');
          setEsGratis(sitioData.esGratis || false);
        } catch (error) {
          console.error('❌ Error al cargar datos:', error);
        } finally {
          setLoadingData(false);
        }
      } else {
        form.resetFields();
        form.setFieldsValue({
          tipoCarga: 'scraping',
          esGratis: false,
          ...initialValues
        });
      }
    };
  
    cargarDatos();
  }, [visible, initialValues, form]);

  const handleSubmit = async (values) => {
    console.log('🔄 Iniciando handleSubmit con valores:', values);
    
    try {
      const transformedValues = { ...values };
      console.log('🔄 Valores transformados:', transformedValues);

      if (values.tipoCarga === 'manual') {
        delete transformedValues.tipoFrecuencia;
        delete transformedValues.configuraciones;
      } else {
        if (values.configuraciones?.length > 0) {
          transformedValues.configuraciones = [{
            ...values.configuraciones[0],
            hora: values.configuraciones[0].hora ? dayjs(values.configuraciones[0].hora).format('HH:mm') : undefined,
            descripcion: values.configuraciones[0].descripcion || '',
            diasSemana: values.configuraciones[0].diasSemana || [],
            diasMes: values.configuraciones[0].diasMes || []
          }];
        }
      }

      if (transformedValues.esGratis) {
        transformedValues.precioDefault = 0;
      }

      if (transformedValues.fechas) {
        const [fechaInicio, fechaFin] = transformedValues.fechas;
        transformedValues.fechaInicio = fechaInicio ? fechaInicio.toDate() : undefined;
        transformedValues.fechaFin = fechaFin ? fechaFin.toDate() : undefined;
        delete transformedValues.fechas;
      }

      console.log('🔄 Guardando sitio...');
      
      let siteId;
      if (initialValues._id) {          
        await onSubmit(transformedValues);
        siteId = initialValues._id;
        console.log('✅ Sitio actualizado con ID:', siteId);
      } else {
        const createResponse = await onSubmit(transformedValues);
        siteId = createResponse._id;
        console.log('✅ Nuevo sitio creado con ID:', siteId);
      }

      if (values.scrapingInmediato) {
        console.log('🔄 Iniciando scraping inmediato');
        setScrapingProgress({
          visible: true,
          currentStep: 0,
          status: {
            initialization: { detail: 'Validando sitio y conexión...' }
          },
          error: null,
          stats: { total: 0, processed: 0 }
        });
        
        try {
          setScrapingProgress(prev => ({
            ...prev,
            currentStep: 1,
            status: {
              ...prev.status,
              extraction: { detail: 'Extrayendo contenido del sitio...' }
            }
          }));

          // Llamada al endpoint de scraping inmediato
          const scrapingResponse = await axios.post(`${API_URL}/api/sites/scrape/${siteId}`);
          const proyecciones = scrapingResponse.data.data.proyecciones;

          setScrapedProjections(proyecciones);

          setScrapingProgress(prev => ({
            ...prev,
            currentStep: 2,
            status: {
              ...prev.status,
              aiProcessing: { detail: 'Procesando con OpenAI...' }
            },
            stats: {
              total: proyecciones.length,
              processed: 0
            }
          }));

          await new Promise(resolve => setTimeout(resolve, 2000));

          setScrapingProgress(prev => ({
            ...prev,
            currentStep: 3,
            status: {
              ...prev.status,
              enrichment: { detail: 'Buscando información adicional...' }
            },
            stats: {
              ...prev.stats,
              processed: Math.floor(prev.stats.total * 0.5)
            }
          }));

          await new Promise(resolve => setTimeout(resolve, 2000));

          setScrapingProgress(prev => ({
            ...prev,
            currentStep: 4,
            status: {
              ...prev.status,
              storage: { detail: 'Guardando proyecciones...' }
            },
            stats: {
              ...prev.stats,
              processed: prev.stats.total
            }
          }));

          await new Promise(resolve => setTimeout(resolve, 2000));

          console.log('✅ Proceso de scraping completado');
          setScrapingProgress(prev => ({
            ...prev,
            currentStep: 5
          }));

          // Cerrar el modal de progreso
          setTimeout(() => {
            setScrapingProgress(prev => ({ ...prev, visible: false }));
            // Mostrar el modal de resultados
            setIsResultModalVisible(true);
          }, 1000);

        } catch (error) {
          console.error('❌ Error en scraping inmediato:', error);
          setScrapingProgress(prev => ({
            ...prev,
            error: error.response?.data?.message || error.message
          }));
        }
      } else {
        console.log('✅ Guardado completado sin scraping inmediato');
        onCancel();
      }
    } catch (error) {
      console.error('❌ Error en submit:', error);
      if (values.scrapingInmediato) {
        setScrapingProgress(prev => ({
          ...prev,
          error: 'Error al guardar el sitio'
        }));
      }
    }
  };

  const handleFrecuenciaChange = (value) => {
    console.log('🔄 Cambio de frecuencia:', value);
    form.setFieldsValue({
      configuraciones: [{}]
    });
  };

  const handleScrapingCancel = () => {
    console.log('🔄 Cancelando modal de scraping');
    console.log('Estado actual:', scrapingProgress);
    
    if (scrapingProgress.error || scrapingProgress.currentStep === 5) {
      setScrapingProgress(prev => ({ ...prev, visible: false }));
      onCancel();
    }
  };

  const handleResultModalClose = () => {
    setIsResultModalVisible(false);
    onCancel();
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
      render: (fechaHora) => moment(fechaHora).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Director',
      dataIndex: 'director',
      key: 'director',
    },
    {
      title: 'País',
      key: 'paisOrigen',
      render: (_, record) => (
        record.esPeliculaArgentina ? (
          <Tag color="blue">Argentina 🧉</Tag>
        ) : (
          <span>{record.paisOrigen || 'No especificado'}</span>
        )
      ),
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
        const horasAntes = moment.duration(ahora.diff(fechaProyeccion)).asHours();

        if (process.env.NODE_ENV === 'production' && horasAntes > 0 && horasAntes <= 3) {
          return <span style={{ color: 'green' }}>Hoy</span>;
        } else if (fechaProyeccion.isBefore(ahora)) {
          return <span style={{ color: 'red' }}>Finalizada</span>;
        } else if (fechaProyeccion.isSame(ahora, 'day')) {
          return <span style={{ color: 'green' }}>Hoy</span>;
        } else {
          return <span style={{ color: 'blue' }}>Próxima</span>;
        }
      },
    }
  ];

  return (
    <>
      <Modal
        title={title}
        open={visible}
        onCancel={onCancel}
        width={800}
        footer={[
          <Button key="cancel" onClick={onCancel}>
            Cancelar
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={() => {
              console.log('🔄 Click en botón Guardar');
              form.submit();
            }}
            loading={loading || loadingData}
            icon={loading || loadingData ? <LoadingOutlined /> : <SaveOutlined />}
          >
            Guardar
          </Button>
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            tipoCarga: 'scraping',
            esGratis: false,
            ...initialValues
          }}
        >
          <Space direction="vertical" className="w-full" size="large" style={{ width: '100%' }}>
            <Divider orientation="left">Información básica</Divider>
            <Row gutter={16}>
              <Col xs={24} sm={24} md={12}>
                <Form.Item
                  name="nombre"
                  label="Nombre del sitio"
                  rules={[
                    { required: true, message: 'El nombre es requerido' },
                    { min: 3, message: 'El nombre debe tener al menos 3 caracteres' }
                  ]}
                >
                  <Input prefix={<GlobalOutlined />} placeholder="Ej: Cine ABC" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={24} md={12}>
                <Form.Item
                  name="url"
                  label="URL del sitio"
                  rules={[
                    { required: true, message: 'La URL es requerida' },
                    { type: 'url', message: 'Ingrese una URL válida' }
                  ]}
                  help="Ingrese la URL completa incluyendo https://"
                >
                  <Input placeholder="https://ejemplo.com" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={24} md={24}>
                <Form.Item
                  name="direccion"
                  label="Dirección física"
                  tooltip="Ubicación física del establecimiento"
                >
                  <Input 
                    prefix={<EnvironmentOutlined />} 
                    placeholder="Ej: Av. Corrientes 1234" 
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">Configuración general</Divider>
            <Row gutter={16}>
              <Col xs={24} sm={24} md={12}>
                <Form.Item
                  name="tipo"
                  label="Tipo de establecimiento"
                  rules={[{ required: true, message: 'Seleccione el tipo' }]}
                >
                  <Select placeholder="Seleccione tipo">
                    <Option value="cine">Cine</Option>
                    <Option value="teatro">Teatro</Option>
                    <Option value="museo">Museo</Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={24} md={12}>
                <Form.Item
                  name="tipoCarga"
                  label="Tipo de carga"
                  rules={[{ required: true, message: 'Seleccione el tipo de carga' }]}
                  tooltip="Define cómo se obtendrá la información de este sitio"
                >
                  <Select 
                    placeholder="Seleccione tipo de carga"
                    onChange={setTipoCarga}
                  >
                    <Option value="scraping">Scraping Automático</Option>
                    <Option value="manual">Carga Manual</Option>
                  </Select>
                </Form.Item>
              </Col>

              {tipoCarga === 'scraping' && (
                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="tipoFrecuencia"
                    label="Frecuencia de Actualización"
                    rules={[{ required: true, message: 'Seleccione la frecuencia' }]}
                    tooltip="Define cada cuánto se actualizará la información"
                  >
                    <Select 
                      placeholder="Seleccione frecuencia"
                      onChange={handleFrecuenciaChange}
                    >
                      <Option value="diaria">Diaria</Option>
                      <Option value="semanal">Semanal</Option>
                      <Option value="mensual">Mensual</Option>
                    </Select>
                  </Form.Item>
                </Col>
              )}

              <Col xs={24} sm={24} md={12}>
                <Form.Item
                  name="esGratis"
                  valuePropName="checked"
                >
                  <Checkbox onChange={e => setEsGratis(e.target.checked)}>
                    Las funciones son gratuitas
                  </Checkbox>
                </Form.Item>
              </Col>

              {!esGratis && (
                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="precioDefault"
                    label="Precio por defecto"
                    tooltip="Este precio se usará cuando no se pueda obtener el precio real"
                  >
                    <InputNumber
                      min={0}
                      step={0.01}
                      placeholder="Ej: 2500.00"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              )}
            </Row>

            {tipoCarga === 'scraping' && (
              <>
                <Divider orientation="left">Configuración de Scraping</Divider>
                <ScrapingConfig 
                  form={form}
                  initialValues={{
                    tipoFrecuencia: schedule?.tipoFrecuencia,
                    configuraciones: schedule?.configuraciones?.length > 0 ? [schedule.configuraciones[0]] : [{}]
                  }}
                />
              </>
            )}

            <Form.Item 
              name="usuarioCreador" 
              hidden={true}
            >
              <Input />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
      
      <ScrapingProgressModal
        visible={scrapingProgress.visible}
        onCancel={handleScrapingCancel}
        currentStep={scrapingProgress.currentStep}
        status={scrapingProgress.status}
        error={scrapingProgress.error}
        stats={scrapingProgress.stats}
        type="scraping"
      />

      <Modal
        title="Proyecciones Recuperadas"
        open={isResultModalVisible}
        onCancel={handleResultModalClose}
        width={1000}
        footer={[
          <Button key="close" onClick={handleResultModalClose}>
            Cerrar
          </Button>
        ]}
      >
        <Table
          columns={columns}
          dataSource={scrapedProjections}
          rowKey={(record) => `${record.nombrePelicula}-${record.fechaHora}`}
        />
      </Modal>
    </>
  );
};

export default SiteModal;
