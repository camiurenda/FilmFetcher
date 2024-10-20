import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin } from 'antd';

const { Title, Text } = Typography;

const WhatsAppQR = () => {
  const [qrCode, setQrCode] = useState('');
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = process.env.NODE_ENV === 'production'
      ? 'wss://filmfetcher.onrender.com'
      : `${wsProtocol}//${window.location.hostname}:5000`;

    console.log('Conectando al WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Conexión WebSocket establecida');
      setStatus('connected');
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

    ws.onclose = () => {
      console.log('Conexión WebSocket cerrada');
      setStatus('disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <Card 
      title={<Title level={4} style={{ color: '#fff' }}>Estado del Bot de WhatsApp</Title>}
      style={{ width: '100%', background: '#1f1f1f', border: '1px solid #303030' }}
      styles={{ body: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }}
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
      {status === 'disconnected' && (
        <Title level={4} style={{ color: 'orange' }}>Conexión perdida. Intenta recargar la página.</Title>
      )}
    </Card>
  );
};

export default WhatsAppQR;