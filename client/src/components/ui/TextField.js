import React, { forwardRef } from 'react';
import styled, { css } from 'styled-components';

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  width: ${({ fullWidth }) => (fullWidth ? '100%' : 'auto')};
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.typography.caption.fontSize};
  color: ${({ theme, error }) => error ? theme.colors.error : theme.colors.textSecondary};
  margin-bottom: 8px;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  font-size: ${({ theme }) => theme.typography.body1.fontSize};
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.08);
  color: ${({ theme }) => theme.colors.textPrimary};
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
  border: 1px solid ${({ theme, error }) => 
    error ? theme.colors.error : 'rgba(255, 255, 255, 0.24)'};
  
  &:focus {
    border-color: ${({ theme, error }) => 
      error ? theme.colors.error : theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme, error }) => 
      error ? `${theme.colors.error}25` : `${theme.colors.primary}25`};
  }
  
  &:hover:not(:focus):not(:disabled) {
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.textDisabled};
  }
  
  ${({ multiline }) => 
    multiline &&
    css`
      min-height: 100px;
      resize: vertical;
    `}
  
  ${({ startAdornment }) => 
    startAdornment &&
    css`
      padding-left: 40px;
    `}
  
  ${({ endAdornment }) => 
    endAdornment &&
    css`
      padding-right: 40px;
    `}
`;

const StartAdornment = styled.div`
  position: absolute;
  left: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  display: flex;
`;

const EndAdornment = styled.div`
  position: absolute;
  right: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  display: flex;
`;

const HelperText = styled.p`
  font-size: ${({ theme }) => theme.typography.caption.fontSize};
  color: ${({ theme, error }) => error ? theme.colors.error : theme.colors.textSecondary};
  margin-top: 4px;
  min-height: 1em;
`;

const TextField = forwardRef((
  {
    id,
    name,
    type = 'text',
    label,
    placeholder,
    value,
    onChange,
    onBlur,
    onFocus,
    error,
    helperText,
    disabled,
    required,
    multiline,
    fullWidth,
    startAdornment,
    endAdornment,
    ...props
  },
  ref
) => {
  const inputProps = {
    id,
    name,
    type,
    placeholder,
    value,
    onChange,
    onBlur,
    onFocus,
    disabled,
    required,
    ref,
    error: !!error,
    multiline,
    startAdornment: !!startAdornment,
    endAdornment: !!endAdornment,
    ...props,
  };

  return (
    <InputContainer fullWidth={fullWidth}>
      {label && (
        <Label htmlFor={id} error={!!error}>
          {label}{required && ' *'}
        </Label>
      )}
      <InputWrapper>
        {startAdornment && <StartAdornment>{startAdornment}</StartAdornment>}
        {multiline ? (
          <StyledInput as="textarea" {...inputProps} />
        ) : (
          <StyledInput {...inputProps} />
        )}
        {endAdornment && <EndAdornment>{endAdornment}</EndAdornment>}
      </InputWrapper>
      <HelperText error={!!error}>{helperText || ' '}</HelperText>
    </InputContainer>
  );
});

export default TextField;