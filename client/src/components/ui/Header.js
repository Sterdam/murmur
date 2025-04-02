import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { 
  FiHome, 
  FiMessageCircle, 
  FiUsers, 
  FiSettings, 
  FiUser, 
  FiLogOut 
} from 'react-icons/fi';
import { useDispatch } from 'react-redux';

import { SecurityContext } from '../../App';
import { logout } from '../../store/slices/authSlice';
import ContactRequestBadge from './ContactRequestBadge';

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
  position: relative;
  
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

const RequestBadgeWrapper = styled.div`
  position: absolute;
  top: -4px;
  right: -8px;
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
          <NavLink to="/" title="Home">
            <FiHome />
            <span>Home</span>
          </NavLink>
          
          <NavLink to="/contacts" title="Contacts">
            <FiMessageCircle />
            <span>Contacts</span>
            <RequestBadgeWrapper>
              <ContactRequestBadge size="small" />
            </RequestBadgeWrapper>
          </NavLink>
          
          <NavLink to="/groups" title="Groups">
            <FiUsers />
            <span>Groups</span>
          </NavLink>
          
          <NavLink to="/profile" title="Profile">
            <FiUser />
            <span>Profile</span>
          </NavLink>
          
          <NavLink to="/settings" title="Settings">
            <FiSettings />
            <span>Settings</span>
          </NavLink>
          
          <LogoutButton onClick={handleLogout} title="Logout">
            <FiLogOut />
            <span>Logout</span>
          </LogoutButton>
        </Nav>
      </HeaderContent>
    </HeaderContainer>
  );
};

export default Header;