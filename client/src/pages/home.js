import React from 'react';
import { Layout, Typography, Space, Row, Col } from 'antd';
import AuthWrapper from '../components/authwrapper/authwrapper';
import DashboardStats from './Stats';

const { Content } = Layout;
const { Title } = Typography;

const Home = () => {
  return (
    <AuthWrapper>
      <Content style={{ padding: '24px', background: '#141414', borderRadius: '8px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={2} style={{ color: '#fff' }}>Dashboard</Title>
          <Row gutter={[16, 16]}>
            <Col>
              <DashboardStats />
            </Col>
          </Row>
        </Space>
      </Content>
    </AuthWrapper>
  );
};

export default Home;