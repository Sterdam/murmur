import React from 'react';
import styled, { css } from 'styled-components';

const StyledCard = styled.div`
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: 8px;
  padding: ${({ padding }) => padding || '16px'};
  box-shadow: ${({ theme, elevation }) => theme.elevation[elevation || 2]};
  color: ${({ theme }) => theme.colors.onSurface};
  display: flex;
  flex-direction: column;
  
  ${({ clickable }) => clickable && css`
    cursor: pointer;
    transition: box-shadow 0.3s, transform 0.2s;
    
    &:hover {
      box-shadow: ${({ theme }) => theme.elevation[6]};
      transform: translateY(-2px);
    }
    
    &:active {
      transform: translateY(0);
    }
  `}
  
  ${({ fullHeight }) => fullHeight && css`
    height: 100%;
  `}
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  padding-bottom: 12px;
  
  ${({ divider, theme }) => divider && css`
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    margin-bottom: 12px;
  `}
`;

const CardTitle = styled.h3`
  ${({ theme }) => theme.typography.h6};
  margin: 0;
  flex: 1;
`;

const CardSubtitle = styled.h4`
  ${({ theme }) => theme.typography.subtitle2};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 4px 0 0;
`;

const CardContent = styled.div`
  flex: 1;
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 12px;
  
  ${({ divider, theme }) => divider && css`
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    margin-top: 12px;
  `}
  
  & > * + * {
    margin-left: 8px;
  }
`;

export { CardHeader, CardTitle, CardSubtitle, CardContent, CardFooter };

const Card = ({
  children,
  elevation,
  padding,
  clickable,
  fullHeight,
  ...props
}) => {
  return (
    <StyledCard
      elevation={elevation}
      padding={padding}
      clickable={clickable}
      fullHeight={fullHeight}
      {...props}
    >
      {children}
    </StyledCard>
  );
};

export default Card;