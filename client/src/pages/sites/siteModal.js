import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Divider, Alert, Space, Checkbox, InputNumber, Row, Col } from 'antd';
import { SaveOutlined, LoadingOutlined, GlobalOutlined, EnvironmentOutlined } from '@ant-design/icons';
import ScrapingConfig from '../../components/schedule/scheduleConfig';
import ScrapingProgressModal from '../../components/Scrap/ScrapingProgressModal';
import moment from 'moment';
import axios from 'axios';
import API_URL from '../../config/api';
import dayjs from 'dayjs';

const { Option } = Select;

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
      // Si hay scraping inmediato, mostramos el modal antes de cualquier operación
      if (values.scrapingInmediato) {
        console.log('🔄 Scraping inmediato detectado, mostrando modal');
        setScrapingProgress({
          visible: true,
          currentStep: 0,
          status: {
            initialization: { detail: 'Validando sitio y conexión...' }
          },
          error: null,
          stats: { total: 0, processed: 0 }
        });
      }

      const transformedValues = { ...values };
      console.log('🔄 Valores transformados:', transformedValues);

      if (values.tipoCarga === 'manual') {
        delete transformedValues.tipoFrecuencia;
        delete transformedValues.configuraciones;
      } else {
        if (values.configuraciones?.length > 0) {
          transformedValues.configuraciones = values.configuraciones.map(config => ({
            ...config,
            hora: config.hora ? dayjs(config.hora).format('HH:mm') : undefined,
            descripcion: config.descripcion || '',
            diasSemana: config.diasSemana || [],
            diasMes: config.diasMes || []
          }));
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

      // Guardamos el sitio y obtenemos el ID
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

      // Si se solicitó scraping inmediato, monitoreamos el progreso
      if (values.scrapingInmediato) {
        console.log('🔄 Monitoreando progreso del scraping');
        
        try {
          // Paso 1: Extracción
          setScrapingProgress(prev => ({
            ...prev,
            currentStep: 1,
            status: {
              ...prev.status,
              extraction: { detail: 'Extrayendo contenido del sitio...' }
            }
          }));

          // Simular espera para el paso de extracción
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Paso 2: Procesamiento IA
          setScrapingProgress(prev => ({
            ...prev,
            currentStep: 2,
            status: {
              ...prev.status,
              aiProcessing: { detail: 'Procesando con OpenAI...' }
            }
          }));

          // Simular espera para el paso de IA
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Paso 3: Enriquecimiento
          setScrapingProgress(prev => ({
            ...prev,
            currentStep: 3,
            status: {
              ...prev.status,
              enrichment: { detail: 'Buscando información adicional...' }
            }
          }));

          // Simular espera para el paso de enriquecimiento
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Paso 4: Almacenamiento
          setScrapingProgress(prev => ({
            ...prev,
            currentStep: 4,
            status: {
              ...prev.status,
              storage: { detail: 'Guardando proyecciones...' }
            }
          }));

          // Simular espera para el paso de almacenamiento
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Completado
          console.log('✅ Proceso de scraping completado');
          setScrapingProgress(prev => ({
            ...prev,
            currentStep: 5  // Proceso completo
          }));

          // Cerrar el modal después de un breve delay
          console.log('🔄 Cerrando modal y formulario');
          setTimeout(() => {
            setScrapingProgress(prev => {
              console.log('Estado final del modal:', prev);
              return { ...prev, visible: false };
            });
            onCancel();
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
            <Row gutter={16}>
              <Col span={24}>
                <Alert
                  message="Información básica"
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              </Col>
              
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

            <Row gutter={16}>
              <Col span={24}>
                <Alert
                  message="Configuración general"
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              </Col>

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
                <Divider>Configuración de Scraping</Divider>
                <ScrapingConfig 
                  form={form}
                  initialValues={{
                    tipoFrecuencia: schedule?.tipoFrecuencia,
                    configuraciones: schedule?.configuraciones?.map(config => ({
                      ...config,
                      hora: config.hora ? dayjs(moment(config.hora, 'HH:mm')) : undefined,
                      diasMes: config.diasMes || [],
                      diasSemana: config.diasSemana || []
                    })) || []
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
    </>
  );
};

export default SiteModal;
