import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin } from 'antd';
import axios from 'axios';
import API_URL from '../../config/api';

const { Text } = Typography;

const TelegramStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/telegram-status`);
        setStatus(response.data.status);
      } catch (error) {
        console.error('Error al obtener el estado del bot de Telegram:', error);
        setStatus({ ok: false, error: 'Error al obtener el estado' });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, []);

  if (loading) {
    return <Spin />;
  }

  return (
    <Card title="Estado del Bot de Telegram" style={{ width: 300 }}>
      {status.ok ? (
        <>
          <Text strong>Estado: </Text>
          <Text type="success">Activo</Text>
          <br />
          <Text strong>Nombre del Bot: </Text>
          <Text>{status.botName}</Text>
          <br />
          <Text strong>ID del Bot: </Text>
          <Text>{status.botId}</Text>
        </>
      ) : (
        <>
          <Text strong>Estado: </Text>
          <Text type="danger">Inactivo</Text>
          <br />
          <Text strong>Error: </Text>
          <Text type="danger">{status.error}</Text>
        </>
      )}
    </Card>
  );
};

export default TelegramStatus;