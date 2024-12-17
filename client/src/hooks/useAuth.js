import { useAuth0 } from '@auth0/auth0-react';
import { useState, useEffect } from 'react';

const whitelistedEmails = [
  'urendacamila@gmail.com',
  //'urendacamila@hotmail.com',
  'sigiliosello@gmail.com'
];

export const useAuth = () => {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading } = useAuth0();
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  useEffect(() => {
    if (isAuthenticated && user) {
      setIsAuthorized(whitelistedEmails.includes(user.email));
    }
  }, [isAuthenticated, user]);

  const handleLogin = () => loginWithRedirect();
  
  const handleLogout = () => logout({ 
    logoutParams: {
      returnTo: window.location.origin
    }
  });

  return {
    user,
    isAuthenticated,
    isLoading,
    isAuthorized,
    handleLogin,
    handleLogout,
  };
};
