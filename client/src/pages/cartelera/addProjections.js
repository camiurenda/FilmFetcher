import React, { useEffect, useState } from 'react';
import { Modal, Checkbox, Form, Input, DatePicker, TimePicker, InputNumber, Select, Button } from 'antd';
import moment from 'moment';
import axios from 'axios';
import API_URL from '../../config/api';

const { Option } = Select;

const AddProjectionModal = ({ isVisible, onCancel, onAdd }) => {
  const [form] = Form.useForm();
  const [sites, setSites] = useState([]);

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/sites`);
        setSites(response.data);
      } catch (error) {
        console.error('Error al obtener sitios:', error);
      }
    };
    fetchSites();
  }, []);

  const handleSubmit = (values) => {
    const fecha = values.fecha.format('YYYY-MM-DD');
    const hora = values.hora.format('HH:mm:ss');
    const fechaHora = moment(`${fecha} ${hora}`).toISOString();

    const formattedValues = {
      ...values,
      fechaHora,
    };
    delete formattedValues.fecha;
    delete formattedValues.hora;

    onAdd(formattedValues);
    form.resetFields();
  };

  return (
    <Modal
      title="Agregar Proyección"
      open={isVisible}
      onCancel={onCancel}
      footer={null}
    >
      <Form
        form={form}
        onFinish={handleSubmit}
        layout="vertical"
      >
        <Form.Item 
          name="nombrePelicula" 
          label="Nombre de la Película" 
          rules={[{ required: true, message: 'Por favor ingrese el nombre de la película' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item 
          name="fecha" 
          label="Fecha" 
          rules={[{ required: true, message: 'Por favor seleccione la fecha' }]}
        >
          <DatePicker 
            format="DD-MM-YYYY"
            inputReadOnly={false}
          />
        </Form.Item>
        <Form.Item 
          name="hora" 
          label="Hora" 
          rules={[{ required: true, message: 'Por favor seleccione la hora' }]}
        >
          <TimePicker 
            format="HH:mm"
            inputReadOnly={false}
          />
        </Form.Item>
        <Form.Item 
          name="sitio" 
          label="Sitio" 
          rules={[{ required: true, message: 'Por favor seleccione el sitio' }]}
        >
          <Select>
            {sites.map(site => (
              <Option key={site._id} value={site._id}>{site.nombre}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="director" label="Director">
          <Input />
        </Form.Item>
        <Form.Item name="genero" label="Género">
          <Input />
        </Form.Item>
        <Form.Item name="paisOrigen" label="País de Origen">
          <Select
            placeholder="Seleccione el país de origen"
            allowClear
          >
            <Option value="Argentina">Argentina</Option>
            <Option value="Estados Unidos">Estados Unidos</Option>
            <Option value="España">España</Option>
            <Option value="Francia">Francia</Option>
            <Option value="Italia">Italia</Option>
            <Option value="Reino Unido">Reino Unido</Option>
            <Option value="México">México</Option>
            <Option value="Brasil">Brasil</Option>
            <Option value="Otro">Otro</Option>
          </Select>
        </Form.Item>
        <Form.Item name="esPeliculaArgentina" valuePropName="checked">
          <Checkbox>Es película argentina</Checkbox>
        </Form.Item>
        <Form.Item name="duracion" label="Duración (minutos)">
          <InputNumber min={1} />
        </Form.Item>
        <Form.Item name="sala" label="Sala">
          <Input />
        </Form.Item>
        <Form.Item name="precio" label="Precio">
          <InputNumber min={0} step={0.01} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            Agregar Proyección
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddProjectionModal;