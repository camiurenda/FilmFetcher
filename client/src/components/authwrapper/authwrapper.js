import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Typography, ConfigProvider, theme } from 'antd';
import Frame from '../frame/frame';

const { Title } = Typography;

const AuthWrapper = ({ children }) => {
  const { isAuthenticated, isLoading, handleLogin } = useAuth();

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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Title>Loading...</Title>
        </div>
      </ConfigProvider>
    );
  }

  if (!isAuthenticated) {
    handleLogin();
    return null;
  }

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
};

export default AuthWrapper;