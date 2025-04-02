import React from 'react';
import styled, { css } from 'styled-components';

const StyledAvatar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  background-color: ${({ theme, color }) => color || theme.colors.primary};
  user-select: none;
  
  ${({ size }) => {
    switch (size) {
      case 'small':
        return css`
          width: 32px;
          height: 32px;
          font-size: 1rem;
        `;
      case 'large':
        return css`
          width: 56px;
          height: 56px;
          font-size: 1.5rem;
        `;
      default:
        return css`
          width: 40px;
          height: 40px;
          font-size: 1.25rem;
        `;
    }
  }}
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  span {
    color: ${({ theme }) => theme.colors.onPrimary};
    font-weight: 500;
    text-transform: uppercase;
  }
`;

const getInitials = (name) => {
  if (!name) return '';
  
  const parts = name.trim().split(' ');
  
  if (parts.length === 1) {
    return parts[0].charAt(0);
  }
  
  return parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
};

const Avatar = ({ src, alt, name, size, color, ...props }) => {
  return (
    <StyledAvatar size={size} color={color} {...props}>
      {src ? (
        <img src={src} alt={alt || name || 'avatar'} />
      ) : (
        <span>{name ? getInitials(name) : '?'}</span>
      )}
    </StyledAvatar>
  );
};

export default Avatar;