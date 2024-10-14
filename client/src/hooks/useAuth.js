import { useAuth0 } from '@auth0/auth0-react';

export const useAuth = () => {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading } = useAuth0();
  
  const redirectUri = process.env.REACT_APP_AUTH0_REDIRECT_URI || 'http://localhost:3000';
  
  console.log('Redirect URI:', redirectUri);

  const handleLogin = () => loginWithRedirect();
  const handleLogout = () => logout({ returnTo: `${redirectUri}/callback` });

  return {
    user,
    isAuthenticated,
    isLoading,
    handleLogin,
    handleLogout,
  };
};