import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin, Button } from 'antd';
import axios from 'axios';
import API_URL from '../../config/api';

const { Text, Title } = Typography;

const TelegramStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/bot-status`);
      setStatus(response.data);
    } catch (error) {
      console.error('Error al obtener el estado del bot:', error);
      setStatus({ status: 'Error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <Card title="Estado del Bot de Telegram" extra={<Button onClick={checkStatus}>Actualizar</Button>}>
      {loading ? (
        <Spin />
      ) : status ? (
        <>
          <Title level={4}>Estado: {status.status}</Title>
          {status.status === 'OK' ? (
            <>
              <Text>Nombre del Bot: {status.botInfo.me.first_name}</Text>
              <br />
              <Text>Username: @{status.botInfo.me.username}</Text>
              <br />
              <Text>Webhook URL: {status.botInfo.webhookInfo.url}</Text>
            </>
          ) : (
            <Text type="danger">{status.message}</Text>
          )}
        </>
      ) : (
        <Text>No se pudo obtener el estado del bot</Text>
      )}
    </Card>
  );
};

export default TelegramStatus;