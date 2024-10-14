import { useAuth0 } from '@auth0/auth0-react';

export const useAuth = () => {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading } = useAuth0();
  
  console.log('Todas las variables de entorno CREADAS:', process.env);
  console.log('REACT_APP_AUTH0_REDIRECT_URI:', process.env.REACT_APP_AUTH0_REDIRECT_URI);
  
  const redirectUri = process.env.REACT_APP_AUTH0_REDIRECT_URI || 'http://localhost:3000';
  
  console.log('Redirect URI final:', redirectUri);

  const handleLogin = () => loginWithRedirect();
  const handleLogout = () => {
    console.log('Ejecutando logout con returnTo:', `${redirectUri}/callback`);
    logout({ returnTo: `${redirectUri}/callback` });
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    handleLogin,
    handleLogout,
  };
};