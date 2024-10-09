import { useAuth0 } from '@auth0/auth0-react';

export const useAuth = () => {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading } = useAuth0();
  
  console.log('Redirect URI:', process.env.REACT_APP_AUTH0_REDIRECT_URI);
//comentario test
  const handleLogin = () => loginWithRedirect();
  const handleLogout = () => logout({ returnTo: 'http://localhost:3000/callback' });

  return {
    user,
    isAuthenticated,
    isLoading,
    handleLogin,
    handleLogout,
  };



};
//Comentario para saber si anda el commit
