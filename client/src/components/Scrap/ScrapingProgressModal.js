import React from 'react';
import { Modal, Steps, Progress, Space, Typography, Button, List } from 'antd';
import { 
  FileSearchOutlined, 
  CloudUploadOutlined, 
  RobotOutlined, 
  VideoCameraOutlined, 
  SaveOutlined, 
  CheckCircleFilled, 
  LoadingOutlined, 
  CloseCircleFilled,
  FileImageOutlined,
  GlobalOutlined
} from '@ant-design/icons';

const { Text } = Typography;

const STEP_CONFIGS = {
  'pdf': {
    icon: FileSearchOutlined,
    title: 'Inicialización',
    description: 'Validando archivo y configuración...'
  },
  'image': {
    icon: FileImageOutlined,
    title: 'Inicialización',
    description: 'Validando archivo y configuración...'
  },
  'scraping': {
    icon: GlobalOutlined,
    title: 'Inicialización',
    description: 'Validando sitio y configuración...'
  }
};

const ScrapingProgressModal = ({ 
  visible, 
  onCancel, 
  status = {}, 
  currentStep = 0,
  error = null,
  stats = { total: 0, processed: 0 },
  type = 'pdf',
  onComplete = () => {}
}) => {

  const getStepConfig = (index) => {
    if (index === 0) return STEP_CONFIGS[type];
    
    const commonSteps = [
      {
        icon: CloudUploadOutlined,
        title: 'Extracción',
        description: 'Extrayendo información...'
      },
      {
        icon: RobotOutlined,
        title: 'Análisis IA',
        description: 'Procesando con OpenAI...'
      },
      {
        icon: VideoCameraOutlined,
        title: 'Enriquecimiento',
        description: 'Buscando información adicional...'
      },
      {
        icon: SaveOutlined,
        title: 'Almacenamiento',
        description: 'Guardando proyecciones...'
      }
    ];

    return commonSteps[index - 1];
  };

  const getStepStatus = (index) => {
    if (error) return index <= currentStep ? 'error' : 'wait';
    if (index === currentStep) return 'process';
    if (index < currentStep) return 'finish';
    return 'wait';
  };

  const getIcon = (Icon, stepStatus) => {
    if (stepStatus === 'finish') return <CheckCircleFilled className="text-green-500" />;
    if (stepStatus === 'error') return <CloseCircleFilled className="text-red-500" />;
    if (stepStatus === 'process') return <LoadingOutlined className="text-blue-500" />;
    return <Icon />;
  };

  const getModalTitle = () => {
    const titles = {
      'pdf': 'Procesamiento de PDF',
      'image': 'Procesamiento de Imagen',
      'scraping': 'Procesamiento de Sitio Web'
    };
    return titles[type] || 'Procesamiento';
  };

  const steps = Array(5).fill(null).map((_, index) => getStepConfig(index));
  React.useEffect(() => {
    if (currentStep === steps.length && !error) {
      onComplete();
    }
  }, [currentStep, error, onComplete]);

  const handleClose = () => {
    if (error || currentStep === steps.length) {
      onCancel();
    }
  };

  return (
    <Modal
      title={getModalTitle()}
      open={visible}
      onCancel={handleClose}
      width={600}
      footer={[
        <Button 
          key="cancel" 
          onClick={handleClose} 
          type="primary" 
          danger
        >
          {error || currentStep === steps.length ? 'Cerrar' : 'Cancelar Proceso'}    
        </Button>
      ]}
    >
      <Space direction="vertical" size="large" className="w-full">
        <Progress 
          percent={Math.round((currentStep / (steps.length - 1)) * 100)} 
          status={error ? 'exception' : currentStep === steps.length ? 'success' : 'active'}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
        />

        <Steps
          direction="vertical"
          size="small"
          current={currentStep}
        >
          {steps.map((step, index) => (
            <Steps.Step
              key={index}
              title={step.title}
              description={
                <Space direction="vertical" size="small">
                  <Text type={getStepStatus(index) === 'process' ? 'warning' : 'secondary'}>
                    {step.description}
                  </Text>
                  {status[Object.keys(status)[index]]?.detail && (
                    <Text type="secondary" className="text-xs">
                      {status[Object.keys(status)[index]].detail}
                    </Text>
                  )}
                  {/* Mostrar lista de proyecciones en el paso de OpenAI */}
                  {index === 2 && status.aiProcessing?.proyecciones && (
                    <List
                      size="small"
                      bordered
                      dataSource={status.aiProcessing.proyecciones}
                      renderItem={item => (
                        <List.Item>
                          <Text>{item.nombre} - {item.fecha} - Sala: {item.sala}</Text>
                        </List.Item>
                      )}
                    />
                  )}
                </Space>
              }
              icon={getIcon(step.icon, getStepStatus(index))}
              status={getStepStatus(index)}
            />
          ))}
        </Steps>

        {stats.total > 0 && (
          <div className="mt-4 p-4 bg-gray-800 rounded">
            <Space direction="vertical" className="w-full">
              <Text>Progreso de procesamiento:</Text>
              <Progress 
                percent={Math.round((stats.processed / stats.total) * 100)}
                format={percent => `${stats.processed}/${stats.total} proyecciones`}
              />
            </Space>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded">
            <Text type="danger">Error: {error}</Text>
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default ScrapingProgressModal;
