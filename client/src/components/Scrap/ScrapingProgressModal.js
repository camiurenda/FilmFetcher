import React from 'react';
import { Modal, Steps, Timeline, Progress, Space, Typography, Button } from 'antd';
import { FileSearchOutlined, CloudUploadOutlined, RobotOutlined, VideoCameraOutlined, SaveOutlined, CheckCircleFilled, LoadingOutlined, CloseCircleFilled} from '@ant-design/icons';

const { Text } = Typography;

const ScrapingProgressModal = ({ 
  visible, 
  onCancel, 
  status = {}, 
  currentStep = 0,
  error = null,
  stats = { total: 0, processed: 0 }
}) => {
  const steps = [
    {
      title: 'Inicialización',
      icon: FileSearchOutlined,
      description: 'Validando PDF y sitio...',
      status: status.initialization
    },
    {
      title: 'Extracción',
      icon: CloudUploadOutlined,
      description: 'Extrayendo contenido del PDF...',
      status: status.extraction
    },
    {
      title: 'Análisis IA',
      icon: RobotOutlined,
      description: 'Procesando con OpenAI...',
      status: status.aiProcessing
    },
    {
      title: 'Enriquecimiento',
      icon: VideoCameraOutlined,
      description: 'Buscando información adicional...',
      status: status.enrichment
    },
    {
      title: 'Almacenamiento',
      icon: SaveOutlined,
      description: 'Guardando proyecciones...',
      status: status.storage
    }
  ];

  const getStepStatus = (index) => {
    if (error) return 'error';
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

  return (
    <Modal
      title="Progreso del Scraping"
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={onCancel} type="primary" danger>
          Cancelar Proceso
        </Button>
      ]}
    >
      <Space direction="vertical" size="large" className="w-full">
        <Progress 
          percent={Math.round((currentStep / (steps.length - 1)) * 100)} 
          status={error ? 'exception' : 'active'}
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
                  {step.status?.detail && (
                    <Text type="secondary" className="text-xs">
                      {step.status.detail}
                    </Text>
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