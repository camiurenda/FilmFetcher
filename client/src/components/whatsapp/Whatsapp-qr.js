import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin } from 'antd';

const { Title, Text } = Typography;

const WhatsAppQR = () => {
  const [qrCode, setQrCode] = useState('');
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const ws = new WebSocket(`${process.env.REACT_APP_WS_URL || 'ws://localhost:5000'}`);

    ws.onopen = () => {
      console.log('Conexión WebSocket establecida');
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'qr') {
        setQrCode(data.data);
        setStatus('waiting');
      } else if (data.type === 'status' && data.data === 'ready') {
        setStatus('connected');
      }
    };

    ws.onerror = (error) => {
      console.error('Error en la conexión WebSocket:', error);
      setStatus('error');
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <Card 
      title={<Title level={4} style={{ color: '#fff' }}>Estado del Bot de WhatsApp</Title>}
      style={{ width: '100%', background: '#1f1f1f', border: '1px solid #303030' }}
      bodyStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {status === 'connecting' && (
        <Spin tip="Conectando...">
          <div style={{ padding: '50px' }}></div>
        </Spin>
      )}
      {status === 'waiting' && qrCode && (
        <>
          <img src={qrCode} alt="WhatsApp QR Code" style={{ width: '80%', maxWidth: '300px' }} />
          <Text style={{ color: '#fff', marginTop: '16px', textAlign: 'center' }}>
            Escanea este código QR con WhatsApp para conectar el bot
          </Text>
        </>
      )}
      {status === 'connected' && (
        <Title level={4} style={{ color: 'green' }}>WhatsApp Bot Conectado</Title>
      )}
      {status === 'error' && (
        <Title level={4} style={{ color: 'red' }}>Error al conectar el bot de WhatsApp</Title>
      )}
    </Card>
  );
};

export default WhatsAppQR;