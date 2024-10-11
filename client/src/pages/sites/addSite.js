import React, { useEffect, useState } from 'react';
import { Layout, Typography, Form, Input, Button, Switch, Select, message } from 'antd';
import AuthWrapper from '../../components/authwrapper/authwrapper';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title } = Typography;

const Addsites = () => {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tipoCarga, setTipoCarga] = useState('scraping');

  useEffect(() => {
    if (user) {
      form.setFieldsValue({ usuarioCreador: user.email, tipoCarga: 'scraping' });
    }
  }, [user, form]);

  const onFinish = async (values) => {
    const siteData = {
      ...values,
      habilitado: true,
      activoParaScraping: values.tipoCarga === 'scraping'
    };
  
    if (values.tipoCarga === 'manual') {
      delete siteData.frecuenciaActualizacion;
    }
  
    try {
      console.log('Datos enviados al servidor:', siteData); // Agregamos este log
      const response = await axios.post('http://localhost:5000/api/sites/add', siteData);
      console.log('Respuesta del servidor:', response.data);
      message.success('Sitio agregado correctamente');
      navigate('/viewsites');
    } catch (error) {
      console.error('Error al agregar el sitio:', error.response ? error.response.data : error.message);
      message.error('Error al agregar el sitio');
    }
  };

  const onTipoCargaChange = (value) => {
    setTipoCarga(value);
    if (value === 'manual') {
      form.setFieldsValue({ frecuenciaActualizacion: undefined });
    }
  };

  return (
    <AuthWrapper>
      <Content style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        <Title level={2} style={{ color: '#fff' }}>Agregar Sitio Web</Title>
        <Form form={form} onFinish={onFinish} layout="vertical" style={{ color: '#fff' }}>
          <Form.Item name="nombre" label="Nombre del sitio web" rules={[{ required: true, message: 'Por favor ingrese el nombre' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="url" label="URL del sitio web" rules={[{ required: true, message: 'Por favor ingrese la URL' }]}>
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
          <Form.Item name="tipoCarga" label="Tipo de Carga" rules={[{ required: true, message: 'Por favor seleccione el tipo de carga' }]}>
            <Select onChange={onTipoCargaChange}>
              <Select.Option value="scraping">Scraping</Select.Option>
              <Select.Option value="manual">Carga Manual</Select.Option>
            </Select>
          </Form.Item>
          {tipoCarga === 'scraping' && (
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
          <Form.Item name="activo" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="usuarioCreador" label="Usuario Creador" rules={[{ required: true, message: 'Por favor ingrese el usuario creador' }]}>
            <Input disabled />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Agregar Sitio
            </Button>
            <Button 
              style={{ marginLeft: '8px' }} 
              onClick={() => navigate('/viewsites')}
            >
              Volver
            </Button>
          </Form.Item>
        </Form>
      </Content>
    </AuthWrapper>
  );
};

export default Addsites;