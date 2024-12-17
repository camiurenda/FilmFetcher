import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Select, 
  TimePicker, 
  DatePicker, 
  Space,
  Input,
  InputNumber,
  Tooltip,
  Collapse,
  Checkbox,
  Card,
  Button
} from 'antd';
import { 
  InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Panel } = Collapse;

const createTimeObject = (time) => {
  if (!time) return undefined;
  
  if (dayjs.isDayjs(time)) {
    return time;
  }
  
  if (typeof time === 'string') {
    const [hours, minutes] = time.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return dayjs().hour(hours).minute(minutes).second(0);
    }
  }
  
  return undefined;
};

const templates = {
  semanal: {
    diasLaborales: {
      descripcion: 'Días Laborales (Lun-Vie)',
      configuraciones: [{
        hora: createTimeObject('09:00'),
        diasSemana: [1, 2, 3, 4, 5],
        descripcion: 'Scraping en días laborales'
      }]
    },
    finDeSemana: {
      descripcion: 'Fin de Semana (Sáb-Dom)',
      configuraciones: [{
        hora: createTimeObject('10:00'),
        diasSemana: [0, 6],
        descripcion: 'Scraping de fin de semana'
      }]
    }
  },
  mensual: {
    inicioDeMes: {
      descripcion: 'Inicio de Mes (Día 1)',
      configuraciones: [{
        hora: createTimeObject('08:00'),
        diasMes: [1],
        descripcion: 'Scraping al inicio del mes'
      }]
    },
    mitadDeMes: {
      descripcion: 'Mitad de Mes (Día 15)',
      configuraciones: [{
        hora: createTimeObject('08:00'),
        diasMes: [15],
        descripcion: 'Scraping a mitad del mes'
      }]
    },
    finDeMes: {
      descripcion: 'Fin de Mes (Día 28/30)',
      configuraciones: [{
        hora: createTimeObject('08:00'),
        diasMes: [28],
        descripcion: 'Scraping al final del mes'
      }]
    }
  }
};

const ScrapingConfig = ({ initialValues = {}, form }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const tipoFrecuencia = Form.useWatch('tipoFrecuencia', form);

  useEffect(() => {
    if (initialValues) {
      if (initialValues.hora) {
        const horaObj = createTimeObject(initialValues.hora);
        form.setFieldsValue({
          configuraciones: [{
            hora: horaObj
          }]
        });
      } else if (initialValues.configuraciones?.length > 0) {
        const configuracion = initialValues.configuraciones[0];
        form.setFieldsValue({
          configuraciones: [{
            ...configuracion,
            hora: configuracion.hora ? createTimeObject(configuracion.hora) : undefined
          }]
        });
      } else {
        form.setFieldsValue({
          configuraciones: [{}]
        });
      }
    }
  }, [initialValues, form]);

  useEffect(() => {
    setSelectedTemplate(null);
  }, [tipoFrecuencia]);

  const handleTemplateSelect = (templateKey, frecuencia) => {
    setSelectedTemplate(templateKey);
    const templateData = templates[frecuencia][templateKey];
    form.setFieldsValue({
      configuraciones: [templateData.configuraciones[0]]
    });
  };

  const renderTemplates = () => {
    if (!tipoFrecuencia || tipoFrecuencia === 'diaria') {
      return null;
    }

    const currentTemplates = templates[tipoFrecuencia];
    if (!currentTemplates) {
      return null;
    }

    return (
      <Card title="Templates Predefinidos (Opcional)" className="mb-4" style={{ marginBottom: '32px' }}>
        <Space>
          {Object.entries(currentTemplates).map(([key, template]) => (
            <Button
              key={key}
              onClick={() => handleTemplateSelect(key, tipoFrecuencia)}
              type={selectedTemplate === key ? 'primary' : 'default'}
            >
              {template.descripcion}
            </Button>
          ))}
        </Space>
      </Card>
    );
  };

  return (
    <div className="w-full">
      {renderTemplates()}

      <Form.List name="configuraciones" initialValue={[{}]}>
        {(fields) => (
          <div className="w-full">
            {fields.slice(0, 1).map(field => (
              <Space key={field.key} direction="vertical" className="w-full" size="large">
                <Form.Item
                  {...field}
                  name={[field.name, "descripcion"]}
                  label="Descripción"
                  style={{ width: '100%' }}
                >
                  <TextArea 
                    rows={2} 
                    placeholder="Describe el propósito de esta configuración"
                    maxLength={200}
                    showCount
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </Form.Item>

                <Form.Item
                  {...field}
                  name={[field.name, "hora"]}
                  label="Hora de Ejecución"
                  rules={[{ required: true, message: 'La hora es requerida' }]}
                  style={{ width: '100%' }}
                >
                  <TimePicker 
                    format="HH:mm"
                    style={{ width: '100%' }}
                    defaultValue={dayjs().hour(9).minute(0)}
                  />
                </Form.Item>

                {tipoFrecuencia === 'semanal' && (
                  <Form.Item
                    {...field}
                    name={[field.name, "diasSemana"]}
                    label="Días de la Semana"
                    rules={[{ required: true, message: 'Seleccione al menos un día' }]}
                    style={{ width: '100%' }}
                  >
                    <Select 
                      mode="multiple" 
                      style={{ width: '100%', minWidth: '200px', maxWidth: '100%' }}
                      dropdownMatchSelectWidth={false}
                    >
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

                {tipoFrecuencia === 'mensual' && (
                  <Form.Item
                    {...field}
                    name={[field.name, "diasMes"]}
                    label="Días del Mes"
                    rules={[{ required: true, message: 'Seleccione al menos un día' }]}
                    style={{ width: '100%' }}
                  >
                    <Select 
                      mode="multiple" 
                      style={{ width: '100%', minWidth: '200px', maxWidth: '100%' }}
                      dropdownMatchSelectWidth={false}
                    >
                      {[...Array(31)].map((_, i) => (
                        <Option key={i + 1} value={i + 1}>{i + 1}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                )}
              </Space>
            ))}
          </div>
        )}
      </Form.List>

      <Collapse defaultActiveKey={[]} style={{ marginTop: '16px', marginBottom: '16px' }}>
        <Panel header="Opciones adicionales" key="1">
          <Space direction="vertical" className="w-full">
            <Form.Item
              name="prioridad"
              label={
                <Space>
                  Prioridad
                  <Tooltip title="Mayor prioridad (1-10) se ejecutará primero en caso de colisión">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              initialValue={1}
              style={{ width: '100%' }}
            >
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="tags"
              label="Tags"
              style={{ width: '100%' }}
            >
              <Select 
                mode="tags" 
                placeholder="Agregar tags"
                style={{ width: '100%', minWidth: '200px', maxWidth: '100%' }}
                dropdownMatchSelectWidth={false}
              >
                <Option value="produccion">Producción</Option>
                <Option value="testing">Testing</Option>
                <Option value="desarrollo">Desarrollo</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="fechas"
              label={
                <Space>
                  Período de Vigencia
                  <Tooltip title="Opcional: Define un período específico para la ejecución del schedule">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              style={{ width: '100%' }}
            >
              <RangePicker 
                showTime
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Space>
        </Panel>
      </Collapse>

      <Form.Item
        name="scrapingInmediato"
        valuePropName="checked"
      >
        <Checkbox>
          Realizar scraping inmediato después de guardar
        </Checkbox>
      </Form.Item>
    </div>
  );
};

export default ScrapingConfig;
