// src/pages/sites/siteModal.js
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Divider, Alert, Space } from 'antd';
import { SaveOutlined, LoadingOutlined, GlobalOutlined, EnvironmentOutlined } from '@ant-design/icons';
import ScrapingConfig from '../../components/schedule/scheduleConfig';
import moment from 'moment';

const { Option } = Select;

const SiteModal = ({ 
  visible, 
  onCancel, 
  onSubmit, 
  initialValues = {}, 
  loading = false,
  title = 'Sitio'
}) => {
  const [form] = Form.useForm();
  const [tipoCarga, setTipoCarga] = useState(initialValues.tipoCarga || 'scraping');

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        ...initialValues,
        hora: initialValues.hora ? moment(initialValues.hora, 'HH:mm') : undefined
      });
      setTipoCarga(initialValues.tipoCarga || 'scraping');
    } else {
      form.resetFields();
    }
  }, [visible, initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // Si es carga manual, eliminar campos de scraping
      if (values.tipoCarga === 'manual') {
        delete values.tipoFrecuencia;
        delete values.hora;
        delete values.diasSemana;
        delete values.diaMes;
        delete values.semanaMes;
        delete values.diaSemana;
        delete values.scrapingInmediato;
      }

      // Formatear hora si existe
      if (values.hora) {
        values.hora = values.hora.format('HH:mm');
      }

      await onSubmit(values);
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
          onClick={handleSubmit}
          loading={loading}
          icon={loading ? <LoadingOutlined /> : <SaveOutlined />}
        >
          Guardar
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
      >
        <Space direction="vertical" className="w-full" size="large">
          {/* Información básica */}
          <div>
            <Alert
              message="Información básica"
              type="info"
              showIcon
              className="mb-4"
            />
            
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
          </div>

          {/* Configuración general */}
          <div>
            <Alert
              message="Configuración general"
              type="info"
              showIcon
              className="mb-4"
            />

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
          </div>

          {/* Configuración de scraping */}
          {tipoCarga === 'scraping' && (
            <>
              <Divider>Configuración de Scraping</Divider>
              <ScrapingConfig 
                form={form} 
                initialValues={initialValues} 
              />
            </>
          )}

          {/* Campo oculto para usuario creador */}
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

SiteModal.defaultProps = {
  visible: false,
  loading: false,
  initialValues: {},
  title: 'Sitio'
};

export default SiteModal;