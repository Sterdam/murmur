import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { FiSave, FiUser, FiKey, FiLock, FiGlobe } from 'react-icons/fi';

// Components
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';

// Services
import { generateKeyPair } from '../services/encryption';
import api from '../services/api';
import { updateUser } from '../store/slices/authSlice';

const ProfileContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 16px;
`;

const ProfileHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 24px;
`;

const ProfileTitle = styled.h1`
  ${({ theme }) => theme.typography.h4};
  margin: 0;
  margin-bottom: 8px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const ProfileDescription = styled.p`
  ${({ theme }) => theme.typography.body2};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  
  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const AvatarWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
`;

const AvatarUploadButton = styled(Button)`
  margin-top: 16px;
`;

const KeyInfo = styled.div`
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 16px;
  font-family: monospace;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSecondary};
  word-break: break-all;
`;

const SecurityOption = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  
  &:last-child {
    border-bottom: none;
  }
`;

const OptionText = styled.div`
  flex: 1;
`;

const OptionTitle = styled.h4`
  ${({ theme }) => theme.typography.subtitle1};
  margin: 0;
  margin-bottom: 4px;
`;

const OptionDescription = styled.p`
  ${({ theme }) => theme.typography.body2};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
`;

const RegionSelector = styled.select`
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.08);
  color: ${({ theme }) => theme.colors.textPrimary};
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 4px;
  margin-top: 8px;
  width: 100%;
  
  option {
    background-color: ${({ theme }) => theme.colors.background};
  }
`;

const Profile = () => {
  const dispatch = useDispatch();
  const { user, keys } = useSelector((state) => state.auth);
  
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [allowedRegions, setAllowedRegions] = useState([]);
  const [updateStatus, setUpdateStatus] = useState({ loading: false, error: null, success: false });

  // Load user data
  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setAllowedRegions(user.allowedRegions || []);
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    try {
      setUpdateStatus({ loading: true, error: null, success: false });
      
      const response = await api.put('/users/profile', {
        displayName,
        bio,
        allowedRegions
      });
      
      if (response.data.success) {
        dispatch(updateUser({
          displayName,
          bio,
          allowedRegions
        }));
        
        setUpdateStatus({ loading: false, error: null, success: true });
        
        // Reset success status after 3 seconds
        setTimeout(() => {
          setUpdateStatus(prev => ({ ...prev, success: false }));
        }, 3000);
      }
    } catch (error) {
      setUpdateStatus({ 
        loading: false, 
        error: error.response?.data?.message || 'Failed to update profile', 
        success: false 
      });
    }
  };

  const handleRegenerateKeys = async () => {
    if (window.confirm('Are you sure you want to regenerate your encryption keys? All your existing conversations will become unreadable.')) {
      try {
        const newKeys = await generateKeyPair();
        
        // Send public key to server
        await api.put('/users/keys', {
          publicKey: newKeys.publicKey
        });
        
        // Update keys in redux store
        dispatch(updateUser({
          keys: newKeys
        }));
      } catch (error) {
        console.error('Failed to regenerate keys:', error);
      }
    }
  };

  const handleRegionChange = (e) => {
    const value = e.target.value;
    
    if (value && !allowedRegions.includes(value)) {
      setAllowedRegions([...allowedRegions, value]);
    }
  };

  const removeRegion = (region) => {
    setAllowedRegions(allowedRegions.filter(r => r !== region));
  };

  return (
    <ProfileContainer>
      <ProfileHeader>
        <div>
          <ProfileTitle>Your Profile</ProfileTitle>
          <ProfileDescription>Manage your personal information and security settings</ProfileDescription>
        </div>
      </ProfileHeader>
      
      <CardGrid>
        {/* Personal Information */}
        <Card>
          <CardHeader divider>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarWrapper>
              <Avatar 
                size="large" 
                src={user?.avatar} 
                name={displayName || username} 
              />
              <AvatarUploadButton variant="outlined" size="small">
                Change Picture
              </AvatarUploadButton>
            </AvatarWrapper>
            
            <TextField
              label="Username"
              value={username}
              disabled
              fullWidth
              startAdornment={<FiUser />}
              helperText="Your unique username cannot be changed"
            />
            
            <TextField
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              fullWidth
              startAdornment={<FiUser />}
            />
            
            <TextField
              label="Bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              multiline
              fullWidth
              helperText="Tell others a bit about yourself"
            />
          </CardContent>
          <CardFooter divider>
            <Button
              variant="contained"
              onClick={handleUpdateProfile}
              disabled={updateStatus.loading}
              startIcon={<FiSave />}
            >
              {updateStatus.loading ? 'Saving...' : 'Save Changes'}
            </Button>
            
            {updateStatus.success && (
              <span style={{ color: 'green', marginLeft: '12px' }}>Profile updated successfully!</span>
            )}
            
            {updateStatus.error && (
              <span style={{ color: 'red', marginLeft: '12px' }}>{updateStatus.error}</span>
            )}
          </CardFooter>
        </Card>
        
        {/* Security & Privacy */}
        <Card>
          <CardHeader divider>
            <CardTitle>Security & Privacy</CardTitle>
          </CardHeader>
          <CardContent>
            <SecurityOption>
              <OptionText>
                <OptionTitle>Encryption Keys</OptionTitle>
                <OptionDescription>Your encryption keys are used for end-to-end encryption</OptionDescription>
                
                {keys && (
                  <KeyInfo>
                    Public Key: {keys.publicKey.substring(0, 20)}...
                  </KeyInfo>
                )}
              </OptionText>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleRegenerateKeys}
                startIcon={<FiKey />}
              >
                Regenerate
              </Button>
            </SecurityOption>
            
            <SecurityOption>
              <OptionText>
                <OptionTitle>Regional Restrictions</OptionTitle>
                <OptionDescription>Limit access to your account from only these regions</OptionDescription>
                
                <RegionSelector onChange={handleRegionChange} value="">
                  <option value="">Add a region...</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="EU">European Union</option>
                  <option value="UK">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="JP">Japan</option>
                </RegionSelector>
                
                <div style={{ marginTop: '12px' }}>
                  {allowedRegions.length > 0 ? (
                    allowedRegions.map(region => (
                      <Button 
                        key={region}
                        variant="outlined" 
                        size="small" 
                        style={{ margin: '0 8px 8px 0' }}
                        onClick={() => removeRegion(region)}
                      >
                        {region} ✕
                      </Button>
                    ))
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                      No regions added (access allowed from anywhere)
                    </span>
                  )}
                </div>
              </OptionText>
              <FiGlobe style={{ marginLeft: '16px', opacity: 0.7 }} />
            </SecurityOption>
            
            <SecurityOption>
              <OptionText>
                <OptionTitle>Change Password</OptionTitle>
                <OptionDescription>Update your account password regularly for better security</OptionDescription>
              </OptionText>
              <Button
                variant="outlined"
                startIcon={<FiLock />}
              >
                Change
              </Button>
            </SecurityOption>
          </CardContent>
        </Card>
      </CardGrid>
    </ProfileContainer>
  );
};

export default Profile;