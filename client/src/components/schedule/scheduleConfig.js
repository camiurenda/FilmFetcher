import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Select, 
  TimePicker, 
  DatePicker, 
  Button, 
  Card, 
  Space,
  Divider,
  Checkbox,
  Input,
  InputNumber,
  Tag,
  Tabs,
  Alert,
  Tooltip
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import moment from 'moment';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

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

// Templates reorganizados por frecuencia
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

const ScrapingConfig = ({ initialValues = {}, form, onError }) => {
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
        const configuracionesConHoraFormateada = initialValues.configuraciones.map(config => ({
          ...config,
          hora: config.hora ? createTimeObject(config.hora) : undefined
        }));
        form.setFieldsValue({
          configuraciones: configuracionesConHoraFormateada
        });
      } else {
        form.setFieldsValue({
          configuraciones: [{}]
        });
      }
    }
  }, [initialValues, form]);

  // Reset template when frequency changes
  useEffect(() => {
    setSelectedTemplate(null);
  }, [tipoFrecuencia]);

  const handleTemplateSelect = (templateKey, frecuencia) => {
    setSelectedTemplate(templateKey);
    const templateData = templates[frecuencia][templateKey];
    
    form.setFieldsValue({
      configuraciones: templateData.configuraciones
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
      <Card title="Templates Predefinidos (Opcional)" className="mb-4">
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

  const renderErrorInfo = () => {
    const error = form.getFieldValue('ultimoError');
    const bloqueo = form.getFieldValue('bloqueo');

    if (bloqueo?.bloqueado) {
      return (
        <Alert
          message="Schedule Bloqueado"
          description={`Razón: ${bloqueo.razon}. Bloqueado desde: ${moment(bloqueo.fechaBloqueo).format('DD/MM/YYYY HH:mm')}`}
          type="error"
          showIcon
          className="mb-4"
        />
      );
    }

    if (error?.mensaje) {
      return (
        <Alert
          message="Último Error"
          description={`${error.mensaje} - ${moment(error.fecha).format('DD/MM/YYYY HH:mm')} (Intentos: ${error.intentos})`}
          type="warning"
          showIcon
          className="mb-4"
        />
      );
    }

    return null;
  };

  return (
    <div className="w-full">
      {renderErrorInfo()}
      {renderTemplates()}

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
      >
        <InputNumber min={1} max={10} />
      </Form.Item>

      <Form.Item
        name="tags"
        label="Tags"
      >
        <Select mode="tags" placeholder="Agregar tags">
          <Option value="produccion">Producción</Option>
          <Option value="testing">Testing</Option>
          <Option value="desarrollo">Desarrollo</Option>
        </Select>
      </Form.Item>

      <Form.List name="configuraciones" initialValue={[{}]}>
        {(fields, { add, remove }) => (
          <div className="w-full">
            {fields.map((field, index) => (
              <Card 
                key={field.key} 
                className="mb-4"
                title={`Configuración ${index + 1}`}
                extra={
                  fields.length > 1 && (
                    <Button 
                      type="text" 
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  )
                }
              >
                <Space direction="vertical" className="w-full" size="large">
                  <Form.Item
                    {...field}
                    name={[field.name, "descripcion"]}
                    label="Descripción"
                  >
                    <TextArea 
                      rows={2} 
                      placeholder="Describe el propósito de esta configuración"
                      maxLength={200}
                      showCount
                    />
                  </Form.Item>

                  <Form.Item
                    {...field}
                    name={[field.name, "hora"]}
                    label="Hora de Ejecución"
                    rules={[{ required: true, message: 'La hora es requerida' }]}
                  >
                    <TimePicker 
                      format="HH:mm"
                      className="w-full"
                      defaultValue={dayjs().hour(9).minute(0)}
                    />
                  </Form.Item>

                  {tipoFrecuencia === 'semanal' && (
                    <Form.Item
                      {...field}
                      name={[field.name, "diasSemana"]}
                      label="Días de la Semana"
                      rules={[{ required: true, message: 'Seleccione al menos un día' }]}
                    >
                      <Select mode="multiple" className="w-full">
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
                    >
                      <Select mode="multiple" className="w-full">
                        {[...Array(31)].map((_, i) => (
                          <Option key={i + 1} value={i + 1}>{i + 1}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  )}
                </Space>
              </Card>
            ))}

            <Button 
              type="dashed" 
              onClick={() => add()} 
              block 
              icon={<PlusOutlined />}
            >
              Agregar Configuración
            </Button>
          </div>
        )}
      </Form.List>

      <Divider />

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
      >
        <RangePicker 
          showTime
          format="YYYY-MM-DD HH:mm"
          className="w-full"
        />
      </Form.Item>

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
