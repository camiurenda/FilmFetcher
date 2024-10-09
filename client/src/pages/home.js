import React from 'react';
import { Layout, Typography } from 'antd';
import AuthWrapper from '../components/authwrapper/authwrapper';
import DashboardStats from './Stats';

const { Content } = Layout;
const { Title } = Typography;

const Home = () => {
  return (
    <AuthWrapper>
      <Content style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        <Title level={2} style={{ color: '#fff', marginBottom: '24px' }}>Estadísticas del Dashboard</Title>
        <DashboardStats />
      </Content>
    </AuthWrapper>
  );
};

export default Home;