import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/home';
import Login from './pages/login';
import ViewSite from './pages/sites/viewSites';
import ViewProjections from './pages/cartelera/viewProjections';
import ScrapingSchedule from './pages/schedule/schedule';
import ScrapingHistory from './pages/historico/scrapingHistory';
import "./style/global.css";

function App() {
  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      redirectUri={window.location.origin}
      audience={`https://${process.env.REACT_APP_AUTH0_DOMAIN}/api/v2/`}
      scope="openid profile email"
    >
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sites" element={<ViewSite />} />
          <Route path="/cartelera" element={<ViewProjections />} />
          <Route path="/scraping-schedule" element={<ScrapingSchedule />} />
          <Route path="/scraping-history" element={<ScrapingHistory />} />
        </Routes>
      </Router>
    </Auth0Provider>
  );
}

export default App;