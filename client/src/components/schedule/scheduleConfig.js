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
  
  // If it's already a dayjs object, return it
  if (dayjs.isDayjs(time)) {
    return time;
  }
  
  // If it's a string in HH:mm format
  if (typeof time === 'string') {
    const [hours, minutes] = time.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return dayjs().hour(hours).minute(minutes).second(0);
    }
  }
  
  return undefined;
};

const templates = {
  diarioLaboral: {
    tipoFrecuencia: 'semanal',
    configuraciones: [{
      hora: createTimeObject('09:00'),
      diasSemana: [1, 2, 3, 4, 5],
      descripcion: 'Scraping diario en días laborales'
    }],
    tags: ['produccion', 'laboral']
  },
  finDeSemana: {
    tipoFrecuencia: 'semanal',
    configuraciones: [{
      hora: createTimeObject('10:00'),
      diasSemana: [0, 6],
      descripcion: 'Scraping de fin de semana'
    }],
    tags: ['produccion', 'finde']
  },
  inicioMes: {
    tipoFrecuencia: 'mensual-dia',
    configuraciones: [{
      hora: createTimeObject('08:00'),
      diasMes: [1],
      descripcion: 'Scraping al inicio de cada mes'
    }],
    tags: ['produccion', 'mensual']
  }
};

const ScrapingConfig = ({ initialValues = {}, form, onError }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);

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

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    const templateData = templates[template];
    
    // Asegurarse de que el tipo de frecuencia se establezca primero
    form.setFieldsValue({
      tipoFrecuencia: templateData.tipoFrecuencia,
      tags: templateData.tags
    });

    // Luego establecer las configuraciones
    form.setFieldsValue({
      configuraciones: templateData.configuraciones
    });
  };

  const renderTemplates = () => (
    <Card title="Templates Predefinidos" className="mb-4">
      <Space>
        {Object.entries(templates).map(([key, template]) => (
          <Button
            key={key}
            onClick={() => handleTemplateSelect(key)}
            type={selectedTemplate === key ? 'primary' : 'default'}
          >
            {template.configuraciones[0].descripcion}
          </Button>
        ))}
      </Space>
    </Card>
  );

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

                  {form.getFieldValue('tipoFrecuencia') === 'semanal' && (
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

                  {form.getFieldValue('tipoFrecuencia') === 'mensual-dia' && (
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

                  {form.getFieldValue('tipoFrecuencia') === 'mensual-posicion' && (
                    <>
                      <Form.Item
                        {...field}
                        name={[field.name, "semanaMes"]}
                        label="Semana del Mes"
                        rules={[{ required: true, message: 'Seleccione la semana' }]}
                      >
                        <Select className="w-full">
                          <Option value="primera">Primera</Option>
                          <Option value="segunda">Segunda</Option>
                          <Option value="tercera">Tercera</Option>
                          <Option value="cuarta">Cuarta</Option>
                          <Option value="ultima">Última</Option>
                        </Select>
                      </Form.Item>

                      <Form.Item
                        {...field}
                        name={[field.name, "diaSemana"]}
                        label="Día de la Semana"
                        rules={[{ required: true, message: 'Seleccione el día' }]}
                      >
                        <Select className="w-full">
                          <Option value={0}>Domingo</Option>
                          <Option value={1}>Lunes</Option>
                          <Option value={2}>Martes</Option>
                          <Option value={3}>Miércoles</Option>
                          <Option value={4}>Jueves</Option>
                          <Option value={5}>Viernes</Option>
                          <Option value={6}>Sábado</Option>
                        </Select>
                      </Form.Item>
                    </>
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
