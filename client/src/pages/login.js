import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    } else {
      loginWithRedirect();  // Redirige automáticamente al usuario a Auth0
    }
  }, [isAuthenticated, navigate, loginWithRedirect]);

  return null;  // No es necesario renderizar nada ya que rediriges automáticamente
};

export default Login;
