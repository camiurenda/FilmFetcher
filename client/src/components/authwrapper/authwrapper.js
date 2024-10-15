import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Typography, ConfigProvider, theme, Button, Alert, Card, Space, Avatar, Spin } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import Frame from '../frame/frame';

const { Title, Text } = Typography;

const AuthWrapper = ({ children }) => {
  const { isAuthenticated, isLoading, isAuthorized, user, handleLogin, handleLogout } = useAuth();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    let timer;
    if (isAuthenticated) {
      // Pequeño retraso para asegurar que la UI esté lista
      timer = setTimeout(() => setShowContent(true), 100);
    } else {
      setShowContent(false);
    }
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#141414' }}>
          <Spin size="large" />
        </div>
      </ConfigProvider>
    );
  }

  if (!isAuthenticated) {
    handleLogin();
    return null;
  }

  if (isAuthenticated && !isAuthorized && showContent) {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh', 
          backgroundColor: '#141414'
        }}>
          <Card
            style={{ 
              width: 400, 
              textAlign: 'center',
              backgroundColor: '#1f1f1f',
              borderColor: '#303030'
            }}
            cover={
              <div style={{ 
                background: 'linear-gradient(135deg, #ff4b2b 0%, #ff416c 100%)', 
                height: 150, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center'
              }}>
                <LockOutlined style={{ fontSize: 60, color: 'white' }} />
              </div>
            }
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Avatar size={64} icon={<UserOutlined />} src={user?.picture} />
              <Title level={3} style={{ color: 'white', margin: 0 }}>Acceso No Autorizado</Title>
              <Text type="secondary">
                Lo sentimos, no tienes permiso para acceder a esta aplicación.
              </Text>
              <Alert
                message={<Text strong style={{ color: 'white' }}>Correo electrónico no autorizado</Text>}
                description={
                  <Text type="secondary">
                    El correo <Text code>{user?.email}</Text> no está en la lista de acceso.
                    Si crees que esto es un error, por favor contacta al administrador.
                  </Text>
                }
                type="error"
                icon={<MailOutlined />}
                showIcon
              />
              <Button type="primary" danger icon={<LockOutlined />} onClick={handleLogout}>
                Cerrar Sesión
              </Button>
            </Space>
          </Card>
        </div>
      </ConfigProvider>
    );
  }

  if (isAuthenticated && isAuthorized && showContent) {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <Frame>{children}</Frame>
      </ConfigProvider>
    );
  }

  // Si llegamos aquí, seguimos cargando
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#141414' }}>
        <Spin size="large" />
      </div>
    </ConfigProvider>
  );
};

export default AuthWrapper;