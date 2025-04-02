// client/src/components/ui/ContactRequestBadge.js
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FiUserPlus } from 'react-icons/fi';
import { fetchContactRequests } from '../../store/slices/contactsSlice';

const BadgeContainer = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const Badge = styled.div`
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background-color: ${({ theme }) => theme.colors.error};
  color: white;
  font-size: 11px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const IconContainer = styled.div`
  width: ${({ size }) => size === 'small' ? '24px' : '28px'};
  height: ${({ size }) => size === 'small' ? '24px' : '28px'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  
  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ContactRequestBadge = ({ size = 'normal', onClick }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { incomingRequests, requestLoading } = useSelector(state => state.contacts);
  const [refreshInterval, setRefreshInterval] = useState(null);
  
  // Fetch contact requests initially
  useEffect(() => {
    dispatch(fetchContactRequests());
    
    // Set up a refresh interval (every 30 seconds)
    const interval = setInterval(() => {
      dispatch(fetchContactRequests());
    }, 30000);
    
    setRefreshInterval(interval);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [dispatch]);
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate('/contacts');
    }
  };
  
  if (incomingRequests.length === 0) {
    return null; // Don't show anything if there are no requests
  }
  
  return (
    <BadgeContainer onClick={handleClick}>
      <IconContainer size={size}>
        <FiUserPlus size={size === 'small' ? 16 : 20} />
      </IconContainer>
      <Badge>{incomingRequests.length}</Badge>
    </BadgeContainer>
  );
};

export default ContactRequestBadge;