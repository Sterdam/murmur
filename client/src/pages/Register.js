import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { registerUser, clearError, generateKeyPair } from '../store/slices/authSlice';
import { storeEncryptionKeys } from '../utils/storage';

// Components
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';

const RegisterContainer = styled.div`
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

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  
  const { loading, error } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  
  const { username, password, confirmPassword } = formData;
  
  const handleChange = (e) => {
    if (error) dispatch(clearError());
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return; // Password validation handled in UI
    }
    
    try {
      // Generate encryption keys
      const keys = await dispatch(generateKeyPair()).unwrap();
      
      // Store keys in localStorage
      storeEncryptionKeys(keys);
      
      // Register user with the public key
      await dispatch(registerUser({ 
        username, 
        password,
        publicKey: keys.publicKey 
      })).unwrap();
      
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  // Validate password match
  const passwordMismatch = password !== confirmPassword && confirmPassword.length > 0;

  return (
    <RegisterContainer>
      <Logo>Murmur</Logo>
      <StyledCard>
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit}>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            
            <TextField
              id="username"
              name="username"
              label="Username"
              placeholder="Choose a username"
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
              placeholder="Choose a password"
              value={password}
              onChange={handleChange}
              fullWidth
              required
            />
            
            <TextField
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm Password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={handleChange}
              error={passwordMismatch}
              helperText={passwordMismatch ? 'Passwords do not match' : ''}
              fullWidth
              required
            />
            
            <Button 
              type="submit" 
              fullWidth 
              disabled={loading || passwordMismatch}
              style={{ marginTop: '16px' }}
            >
              {loading ? 'Creating Account...' : 'Register'}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter divider>
          <p>
            Already have an account?{' '}
            <Link to="/login">Log In</Link>
          </p>
        </CardFooter>
      </StyledCard>
    </RegisterContainer>
  );
};

export default Register;