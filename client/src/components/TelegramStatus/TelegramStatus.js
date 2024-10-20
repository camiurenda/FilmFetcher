import React, { useState } from 'react';
import { Button, message, Spin, Typography } from 'antd';
import axios from 'axios';

const { Text } = Typography;

const TelegramTest = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const runTest = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/test-telegram');
      setResult(response.data);
      message.success('Prueba completada con éxito');
    } catch (error) {
      console.error('Error al ejecutar la prueba:', error);
      message.error('Error al ejecutar la prueba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button onClick={runTest} disabled={loading}>
        Ejecutar prueba de Telegram
      </Button>
      {loading && <Spin />}
      {result && (
        <div>
          <Text strong>Resultados de la prueba:</Text>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default TelegramTest;