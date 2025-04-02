import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FiHome, FiMessageCircle, FiUsers, FiSettings, FiUser, FiLogOut } from 'react-icons/fi';
import { useDispatch } from 'react-redux';

import { SecurityContext } from '../../App';
import { logout } from '../../store/slices/authSlice';

const HeaderContainer = styled.header`
  background-color: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.elevation[1]};
  padding: 0.5rem 1rem;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10;
`;

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
`;

const Logo = styled(Link)`
  ${({ theme }) => theme.typography.h6};
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
  display: flex;
  align-items: center;
  font-weight: bold;
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
`;

const NavLink = styled(Link)`
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-left: 1.5rem;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.75rem;
  opacity: 0.8;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 1;
  }
  
  svg {
    font-size: 1.25rem;
    margin-bottom: 0.2rem;
  }
`;

const LogoutButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-left: 1.5rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.75rem;
  opacity: 0.8;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 1;
  }
  
  svg {
    font-size: 1.25rem;
    margin-bottom: 0.2rem;
  }
`;

const Header = () => {
  const { user, isAuthenticated } = useContext(SecurityContext);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };
  
  if (!isAuthenticated) return null;
  
  return (
    <HeaderContainer>
      <HeaderContent>
        <Logo to="/">Murmur</Logo>
        
        <Nav>
          <NavLink to="/">
            <FiHome />
            <span>Home</span>
          </NavLink>
          
          <NavLink to="/contacts">
            <FiMessageCircle />
            <span>Messages</span>
          </NavLink>
          
          <NavLink to="/groups">
            <FiUsers />
            <span>Groups</span>
          </NavLink>
          
          <NavLink to="/profile">
            <FiUser />
            <span>Profile</span>
          </NavLink>
          
          <NavLink to="/settings">
            <FiSettings />
            <span>Settings</span>
          </NavLink>
          
          <LogoutButton onClick={handleLogout}>
            <FiLogOut />
            <span>Logout</span>
          </LogoutButton>
        </Nav>
      </HeaderContent>
    </HeaderContainer>
  );
};

export default Header;