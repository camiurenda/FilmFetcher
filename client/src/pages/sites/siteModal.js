import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Divider, Alert, Space, Checkbox, InputNumber, Row, Col } from 'antd';
import { SaveOutlined, LoadingOutlined, GlobalOutlined, EnvironmentOutlined } from '@ant-design/icons';
import ScrapingConfig from '../../components/schedule/scheduleConfig';
import siteService from '../../service/site.service';
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
  const [form] = Form.useForm();
  const [tipoCarga, setTipoCarga] = useState(initialValues?.tipoCarga || 'scraping');
  const [esGratis, setEsGratis] = useState(initialValues?.esGratis || false);
  const [loadingData, setLoadingData] = useState(false);
  const [schedule, setSchedule] = useState(null);

  useEffect(() => {
    const cargarDatos = async () => {
      if (visible && initialValues._id) {
        try {
          setLoadingData(true);
          console.log('Cargando datos para sitio:', initialValues._id);
          
          const [sitioResponse, scheduleResponse] = await Promise.all([
            axios.get(`${API_URL}/api/sites/${initialValues._id}`),
            axios.get(`${API_URL}/api/scraping-schedule/sitio/${initialValues._id}`)
          ]);
          
          const sitioData = sitioResponse.data;
          const scheduleData = scheduleResponse.data;
  
          console.log('Datos del sitio cargados:', sitioData);
          console.log('Schedule encontrado:', scheduleData);
  
          setSchedule(scheduleData);

          // Combinar datos del sitio y schedule
          const formData = {
            ...sitioData,
            tipoFrecuencia: scheduleData?.tipoFrecuencia,
            configuraciones: scheduleData?.configuraciones?.map(config => ({
              ...config,
              hora: config.hora ? dayjs(moment(config.hora, 'HH:mm')) : undefined
            })) || []
          };
  
          console.log('Datos combinados para el formulario:', formData);
          form.setFieldsValue(formData);
  
          setTipoCarga(sitioData.tipoCarga || 'scraping');
          setEsGratis(sitioData.esGratis || false);
        } catch (error) {
          console.error('Error al cargar datos:', error);
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
    try {
      const transformedValues = { ...values };

      if (values.tipoCarga === 'manual') {
        delete transformedValues.tipoFrecuencia;
        delete transformedValues.configuraciones;
      } else {
        // Set frecuenciaActualizacion from tipoFrecuencia for the site model
        transformedValues.frecuenciaActualizacion = values.tipoFrecuencia;

        // Transform configurations
        if (values.configuraciones && values.configuraciones.length > 0) {
          transformedValues.configuraciones = values.configuraciones.map(config => ({
            ...config,
            hora: config.hora ? dayjs(config.hora).format('HH:mm') : undefined,
            descripcion: config.descripcion || '',
            diasSemana: config.diasSemana || [],
            diasMes: config.diasMes || [],
            semanaMes: config.semanaMes,
            diaSemana: config.diaSemana
          }));

          // Set configuracionScraping for backward compatibility
          const firstConfig = transformedValues.configuraciones[0];
          transformedValues.configuracionScraping = {
            tipoFrecuencia: values.tipoFrecuencia,
            hora: firstConfig.hora || '09:00', // Default to 9 AM if no time is set
            diasSemana: firstConfig.diasSemana || [],
            errores: []
          };
        }
      }

      if (transformedValues.esGratis) {
        transformedValues.precioDefault = 0;
      }

      // Ensure proper format for schedule-related fields
      if (transformedValues.fechas) {
        const [fechaInicio, fechaFin] = transformedValues.fechas;
        transformedValues.fechaInicio = fechaInicio ? fechaInicio.toDate() : undefined;
        transformedValues.fechaFin = fechaFin ? fechaFin.toDate() : undefined;
        delete transformedValues.fechas;
      }

      console.log('Valores transformados:', transformedValues);
      await onSubmit(transformedValues);
    } catch (error) {
      console.error('Error en validación:', error);
    }
  };

  return (
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
          onClick={() => form.submit()}
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
                >
                  <Select placeholder="Seleccione frecuencia">
                    <Option value="diaria">Diaria</Option>
                    <Option value="semanal">Semanal</Option>
                    <Option value="mensual-dia">Mensual (por día)</Option>
                    <Option value="mensual-posicion">Mensual (por posición)</Option>
                    <Option value="test">Test</Option>
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
                    hora: config.hora ? dayjs(moment(config.hora, 'HH:mm')) : undefined
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
  );
};

export default SiteModal;
