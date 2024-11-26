import React, { useState, useEffect } from 'react';
import { Layout, Space, Modal, Button, Typography, message, Select, Spin } from 'antd';
import { PlusOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';
import API_URL from '../../config/api';
import ScheduleConfig from '../../components/schedule/scheduleConfig';
import ScheduleList from '../../components/schedule/scheduleList';
import AuthWrapper from '../../components/authwrapper/authwrapper';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const ScrapingSchedule = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [sitiosDisponibles, setSitiosDisponibles] = useState([]);
  const [sitioSeleccionado, setSitioSeleccionado] = useState(null);
  const [scheduleExistente, setScheduleExistente] = useState(null);
  const [loadingSitios, setLoadingSitios] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    cargarSitiosDisponibles();
  }, []);

  const cargarSitiosDisponibles = async () => {
    try {
      setLoadingSitios(true);
      // Obtener sitios que no tienen schedule activo y están habilitados para scraping
      const [sitiosResponse, schedulesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/sites`),
        axios.get(`${API_URL}/api/scraping-schedule`)
      ]);

      // Filtrar sitios que ya tienen schedule y asegurarnos que están habilitados para scraping
      const sitiosConSchedule = new Set(schedulesResponse.data.map(s => s.sitioId));
      const sitiosFiltered = sitiosResponse.data.filter(
        sitio => !sitiosConSchedule.has(sitio._id) && 
                 sitio.activoParaScraping &&
                 sitio.habilitado
      );

      setSitiosDisponibles(sitiosFiltered);
    } catch (error) {
      console.error('Error al cargar sitios:', error);
      message.error('Error al cargar sitios disponibles');
    } finally {
      setLoadingSitios(false);
      setLoadingPage(false);
    }
  };

  const showModal = () => {
    setIsModalVisible(true);
    setSitioSeleccionado(null);
    setScheduleExistente(null);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setSitioSeleccionado(null);
    setScheduleExistente(null);
  };

  const handleSuccess = () => {
    message.success('Schedule guardado correctamente');
    setIsModalVisible(false);
    setSitioSeleccionado(null);
    setScheduleExistente(null);
    cargarSitiosDisponibles();
  };

  const handleEditSchedule = async (schedule) => {
    try {
      // Obtener detalles completos del schedule
      const response = await axios.get(`${API_URL}/api/scraping-schedule/${schedule._id}`);
      setScheduleExistente(response.data);
      setSitioSeleccionado(schedule.sitioId);
      setIsModalVisible(true);
    } catch (error) {
      console.error('Error al cargar detalles del schedule:', error);
      message.error('Error al cargar detalles del schedule');
    }
  };

  const handleSyncNow = async () => {
    try {
      await axios.post(`${API_URL}/api/scraping-schedule/sync`);
      message.success('Sincronización iniciada');
    } catch (error) {
      console.error('Error al sincronizar:', error);
      message.error('Error al iniciar sincronización');
    }
  };

  return (
    <AuthWrapper>
      <div style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        {loadingPage ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
            <Text style={{ display: 'block', marginTop: '16px', color: '#fff' }}>
              Cargando configuración de schedules...
            </Text>
          </div>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={2} style={{ color: '#fff', margin: 0 }}>
                Horario de Scraping
              </Title>
              <Space>
                <Button
                  type="primary"
                  icon={<SyncOutlined />}
                  onClick={handleSyncNow}
                >
                  Sincronizar Ahora
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={showModal}
                  disabled={sitiosDisponibles.length === 0}
                >
                  Nuevo Schedule
                </Button>
              </Space>
            </div>

            <ScheduleList onEditSchedule={handleEditSchedule} />

            <Modal
              title={scheduleExistente ? "Editar Schedule" : "Nuevo Schedule"}
              open={isModalVisible}
              onCancel={handleCancel}
              footer={null}
              width={800}
            >
              {!scheduleExistente && (
                <Select
                  style={{ width: '100%', marginBottom: 16 }}
                  placeholder="Selecciona un sitio"
                  loading={loadingSitios}
                  value={sitioSeleccionado}
                  onChange={setSitioSeleccionado}
                >
                  {sitiosDisponibles.map(sitio => (
                    <Option key={sitio._id} value={sitio._id}>
                      {sitio.nombre}
                    </Option>
                  ))}
                </Select>
              )}

              {(sitioSeleccionado || scheduleExistente) && (
                <ScheduleConfig
                  sitioId={sitioSeleccionado || scheduleExistente.sitioId}
                  scheduleExistente={scheduleExistente}
                  onSuccess={handleSuccess}
                />
              )}
            </Modal>
          </Space>
        )}
      </div>
    </AuthWrapper>
  );
};

export default ScrapingSchedule;