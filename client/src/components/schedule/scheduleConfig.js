import React, { useState } from 'react';
import { Form, Select, TimePicker, Checkbox, Card, Space } from 'antd';
import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Option } = Select;

const ScrapingConfig = ({ initialValues = {}, form }) => {
  const [tipoFrecuencia, setTipoFrecuencia] = useState(
    initialValues.tipoFrecuencia || 'diaria'
  );

  const handleTipoFrecuenciaChange = (value) => {
    setTipoFrecuencia(value);
    form.setFieldsValue({
      diasSemana: undefined,
      diaMes: undefined,
      semanaMes: undefined,
      diaSemana: undefined
    });
  };

  return (
    <div className="w-full">
      <Card className="w-full mb-4">
        <Space direction="vertical" className="w-full" size="large">
          <Form.Item
            name="tipoFrecuencia"
            label="Tipo de Frecuencia"
            rules={[{ required: true, message: 'Seleccione el tipo de frecuencia' }]}
            className="w-full"
          >
            <Select 
              onChange={handleTipoFrecuenciaChange}
              className="w-full"
            >
              <Option value="diaria">Diaria</Option>
              <Option value="semanal">Semanal</Option>
              <Option value="mensual-dia">Mensual (día específico)</Option>
              <Option value="mensual-posicion">Mensual (posición)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="hora"
            label="Hora de Ejecución"
            rules={[{ required: true, message: 'Seleccione la hora de ejecución' }]}
            className="w-full"
          >
            <TimePicker 
              format="HH:mm" 
              className="w-full"
              placeholder="Seleccione hora"
            />
          </Form.Item>

          {tipoFrecuencia === 'semanal' && (
            <Form.Item
              name="diasSemana"
              label="Días de la Semana"
              rules={[{ required: true, message: 'Seleccione al menos un día' }]}
              className="w-full"
            >
              <Select mode="multiple" placeholder="Seleccione días" className="w-full">
                <Option value={0}>Domingo</Option>
                <Option value={1}>Lunes</Option>
                <Option value={2}>Martes</Option>
                <Option value={3}>Miércoles</Option>
                <Option value={4}>Jueves</Option>
                <Option value={5}>Viernes</Option>
                <Option value={6}>Sábado</Option>
              </Select>
            </Form.Item>
          )}

          {tipoFrecuencia === 'mensual-dia' && (
            <Form.Item
              name="diaMes"
              label="Día del Mes"
              rules={[{ required: true, message: 'Seleccione el día del mes' }]}
              className="w-full"
            >
              <Select placeholder="Seleccione día" className="w-full">
                {[...Array(31)].map((_, i) => (
                  <Option key={i + 1} value={i + 1}>{i + 1}</Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {tipoFrecuencia === 'mensual-posicion' && (
            <Space direction="vertical" className="w-full" size="middle">
              <Form.Item
                name="semanaMes"
                label="Semana del Mes"
                rules={[{ required: true, message: 'Seleccione la semana' }]}
                className="w-full"
              >
                <Select placeholder="Seleccione semana" className="w-full">
                  <Option value="primera">Primera</Option>
                  <Option value="segunda">Segunda</Option>
                  <Option value="tercera">Tercera</Option>
                  <Option value="cuarta">Cuarta</Option>
                  <Option value="ultima">Última</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="diaSemana"
                label="Día de la Semana"
                rules={[{ required: true, message: 'Seleccione el día' }]}
                className="w-full"
              >
                <Select placeholder="Seleccione día" className="w-full">
                  <Option value={0}>Domingo</Option>
                  <Option value={1}>Lunes</Option>
                  <Option value={2}>Martes</Option>
                  <Option value={3}>Miércoles</Option>
                  <Option value={4}>Jueves</Option>
                  <Option value={5}>Viernes</Option>
                  <Option value={6}>Sábado</Option>
                </Select>
              </Form.Item>
            </Space>
          )}

          <Form.Item
            name="scrapingInmediato"
            valuePropName="checked"
            className="w-full"
          >
            <Checkbox>
              Realizar scraping inmediato después de guardar
            </Checkbox>
          </Form.Item>
        </Space>
      </Card>
    </div>
  );
};

export default ScrapingConfig;