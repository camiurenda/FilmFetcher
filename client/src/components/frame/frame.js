import React from 'react';
import { Avatar, Typography, Layout, Menu, theme, Dropdown } from 'antd';
import { useAuth } from '../../hooks/useAuth';
import { UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import Logo from '../../assets/logoheader.png';

const { Header, Content, Footer } = Layout;

const Frame = ({ children }) => {
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const { user, handleLogout } = useAuth();

  const menuItems = [
    {
      key: 'logout',
      label: (
        <a onClick={handleLogout}>Logout</a>
      ),
    },
  ];
  const items = [
    {
      key: 1,
      label: 'Inicio',
      onClick: () => navigate('/'),
    },
    {
      key: 2,
      label: 'Sitios',
      onClick: () => navigate('/viewSites'),
    },
    {
      key: 3,
      label: 'Cartelera',
      onClick: () => navigate('/cartelera'),  // Asegúrate de que esto sea '/cartelera'
    },
    {
      key: 4,
      label: 'Schedule de Scraping',
      onClick: () => navigate('/scraping-schedule'),
    },
    {
      key: 5,
      label: 'Historial de Scraping',
      onClick: () => navigate('/scraping-history'),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        <div className="logo">
          <img src={Logo} alt="Logo" style={{ height: '40px', marginRight: '20px', marginTop: '30px' }} />
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          items={items}
          style={{ flex: 1 }}
        />
        <Dropdown menu={{ items: menuItems }}>
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <Avatar src={user.picture} icon={!user.picture && <UserOutlined />} />
            <Typography.Text style={{ marginLeft: 10, color: '#fff' }}>{user.name}</Typography.Text>
          </div>
        </Dropdown>
      </Header>
      <Content style={{ flex: 1, padding: '24px' }}>
        <div style={{
          background: colorBgContainer,
          padding: 24,
          borderRadius: borderRadiusLG,
          minHeight: '100%',
        }}>
          {children}
        </div>
      </Content>
      <Footer style={{ textAlign: 'center', background: colorBgContainer }}>
        TechLabs {new Date().getFullYear()}
      </Footer>
    </Layout>
  );
};

export default Frame;