import React from 'react';
import { Layout, Typography, Space } from 'antd';
import AuthWrapper from '../components/authwrapper/authwrapper';
import DashboardStats from './Stats';
import TelegramStatus from '../components/TelegramStatus/TelegramStatus';

const { Content } = Layout;
const { Title } = Typography;

const Home = () => {
  return (
    <AuthWrapper>
      <Content style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={2} style={{ color: '#fff' }}>Estadísticas del Dashboard</Title>
          <DashboardStats />
          <TelegramStatus />
        </Space>
      </Content>
    </AuthWrapper>
  );
};

export default Home;