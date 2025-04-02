import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { loginUser, clearError } from '../store/slices/authSlice';

// Components
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';

const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 16px;
`;

const Logo = styled.h1`
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 24px;
  font-size: 3rem;
`;

const StyledCard = styled(Card)`
  width: 100%;
  max-width: 400px;
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  margin-bottom: 16px;
  text-align: center;
`;

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  
  const { loading, error } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  
  const { username, password } = formData;
  
  const handleChange = (e) => {
    if (error) dispatch(clearError());
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser({ username, password }));
  };

  return (
    <LoginContainer>
      <Logo>Murmur</Logo>
      <StyledCard>
        <CardHeader>
          <CardTitle>Log In</CardTitle>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit}>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            
            <TextField
              id="username"
              name="username"
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChange={handleChange}
              fullWidth
              required
            />
            
            <TextField
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={handleChange}
              fullWidth
              required
            />
            
            <Button 
              type="submit" 
              fullWidth 
              disabled={loading}
              style={{ marginTop: '16px' }}
            >
              {loading ? 'Logging in...' : 'Log In'}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter divider>
          <p>
            Don't have an account?{' '}
            <Link to="/register">Register</Link>
          </p>
        </CardFooter>
      </StyledCard>
    </LoginContainer>
  );
};

export default Login;