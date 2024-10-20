import React from 'react';
import { Layout, Typography, Space } from 'antd';
import AuthWrapper from '../components/authwrapper/authwrapper';
import DashboardStats from './Stats';
import WhatsAppQR from '../components/whatsapp/Whatsapp-qr';

const { Content } = Layout;
const { Title } = Typography;

const Home = () => {
  return (
    <AuthWrapper>
      <Content style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={2} style={{ color: '#fff' }}>Dashboard</Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <DashboardStats />
            </Col>
            <Col xs={24} lg={8}>
              <WhatsAppQR />
            </Col>
          </Row>
        </Space>
      </Content>
    </AuthWrapper>
  );
};

export default Home;