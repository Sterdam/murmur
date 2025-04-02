import React from 'react';
import styled, { css } from 'styled-components';

const StyledButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 64px;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.typography.button.fontSize};
  font-weight: ${({ theme }) => theme.typography.button.fontWeight};
  letter-spacing: ${({ theme }) => theme.typography.button.letterSpacing};
  text-transform: ${({ theme }) => theme.typography.button.textTransform};
  transition: background-color 0.3s, box-shadow 0.3s;
  outline: none;
  border: none;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  
  ${({ size }) => {
    switch (size) {
      case 'small':
        return css`
          padding: 4px 8px;
          font-size: 0.8125rem;
        `;
      case 'large':
        return css`
          padding: 10px 22px;
          font-size: 0.9375rem;
        `;
      default:
        return null;
    }
  }}
  
  ${({ variant, theme }) => {
    switch (variant) {
      case 'contained':
        return css`
          background-color: ${theme.colors.primary};
          color: ${theme.colors.onPrimary};
          box-shadow: ${theme.elevation[2]};
          
          &:hover {
            background-color: ${theme.colors.primaryDark};
            box-shadow: ${theme.elevation[4]};
          }
          
          &:active {
            box-shadow: ${theme.elevation[8]};
          }
          
          &:disabled {
            background-color: rgba(255, 255, 255, 0.12);
            color: ${theme.colors.textDisabled};
            box-shadow: none;
            cursor: not-allowed;
          }
        `;
      case 'outlined':
        return css`
          background-color: transparent;
          color: ${theme.colors.primary};
          border: 1px solid ${theme.colors.primary};
          
          &:hover {
            background-color: rgba(98, 0, 238, 0.08);
          }
          
          &:active {
            background-color: rgba(98, 0, 238, 0.16);
          }
          
          &:disabled {
            color: ${theme.colors.textDisabled};
            border-color: ${theme.colors.textDisabled};
            cursor: not-allowed;
          }
        `;
      case 'text':
      default:
        return css`
          background-color: transparent;
          color: ${theme.colors.primary};
          
          &:hover {
            background-color: rgba(98, 0, 238, 0.08);
          }
          
          &:active {
            background-color: rgba(98, 0, 238, 0.16);
          }
          
          &:disabled {
            color: ${theme.colors.textDisabled};
            cursor: not-allowed;
          }
        `;
    }
  }}
  
  ${({ fullWidth }) => fullWidth && css`
    width: 100%;
  `}
  
  ${({ color, theme, variant }) => {
    if (color === 'secondary') {
      if (variant === 'contained') {
        return css`
          background-color: ${theme.colors.secondary};
          color: ${theme.colors.onSecondary};
          
          &:hover {
            background-color: ${theme.colors.secondaryDark};
          }
        `;
      } else {
        return css`
          color: ${theme.colors.secondary};
          
          &:hover {
            background-color: rgba(3, 218, 198, 0.08);
          }
          
          &:active {
            background-color: rgba(3, 218, 198, 0.16);
          }
          
          ${variant === 'outlined' && css`
            border-color: ${theme.colors.secondary};
          `}
        `;
      }
    }
    
    if (color === 'error') {
      if (variant === 'contained') {
        return css`
          background-color: ${theme.colors.error};
          color: ${theme.colors.onError};
        `;
      } else {
        return css`
          color: ${theme.colors.error};
          
          ${variant === 'outlined' && css`
            border-color: ${theme.colors.error};
          `}
        `;
      }
    }
    
    return null;
  }}
  
  /* Icon positioning */
  & > svg {
    margin-right: ${({ endIcon }) => (endIcon ? 0 : 8)}px;
    margin-left: ${({ startIcon }) => (startIcon ? 0 : 8)}px;
    
    ${({ iconOnly }) => iconOnly && css`
      margin: 0;
      font-size: 1.5rem;
    `}
  }
`;

const Button = ({
  children,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  disabled = false,
  fullWidth = false,
  startIcon,
  endIcon,
  iconOnly = false,
  ...props
}) => {
  return (
    <StyledButton
      variant={variant}
      color={color}
      size={size}
      disabled={disabled}
      fullWidth={fullWidth}
      startIcon={!!startIcon}
      endIcon={!!endIcon}
      iconOnly={iconOnly}
      {...props}
    >
      {startIcon}
      {children}
      {endIcon}
    </StyledButton>
  );
};

export default Button;