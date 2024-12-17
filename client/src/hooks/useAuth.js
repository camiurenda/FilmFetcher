import { useAuth0 } from '@auth0/auth0-react';
import { useState, useEffect } from 'react';

const whitelistedEmails = [
  'urendacamila@gmail.com',
  //'urendacamila@hotmail.com',
  'sigiliosello@gmail.com'
];

const PRODUCTION_URL = 'https://film-fetcher-eta.vercel.app';
const DEVELOPMENT_URL = 'http://localhost:3000';

export const useAuth = () => {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading } = useAuth0();
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  useEffect(() => {
    if (isAuthenticated && user) {
      setIsAuthorized(whitelistedEmails.includes(user.email));
    }
  }, [isAuthenticated, user]);

  const handleLogin = () => loginWithRedirect();
  
  const handleLogout = () => {
    // Determinar si estamos en producción o desarrollo
    const isProd = window.location.origin.includes('vercel.app');
    const redirectUri = isProd ? PRODUCTION_URL : DEVELOPMENT_URL;
    console.log('Redirigiendo a:', redirectUri);
    logout({ returnTo: redirectUri });
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    isAuthorized,
    handleLogin,
    handleLogout,
  };
};
