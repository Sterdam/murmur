import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { FiSave, FiMoon, FiSun, FiBell, FiShield, FiGlobe, FiDatabase } from 'react-icons/fi';

// Components
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import Button from '../components/ui/Button';

// Services & Store
import api from '../services/api';
import { updateSettings } from '../store/slices/authSlice';

const SettingsContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 16px;
`;

const SettingsHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 24px;
`;

const SettingsTitle = styled.h1`
  ${({ theme }) => theme.typography.h4};
  margin: 0;
  margin-bottom: 8px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const SettingsDescription = styled.p`
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

const SettingOption = styled.div`
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

const Toggle = styled.label`
  position: relative;
  display: inline-block;
  width: 52px;
  height: 26px;
  
  input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.2);
    transition: .4s;
    border-radius: 34px;
    
    &:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
  }
  
  input:checked + span {
    background-color: ${({ theme }) => theme.colors.primary};
  }
  
  input:checked + span:before {
    transform: translateX(26px);
  }
`;

const Select = styled.select`
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.08);
  color: ${({ theme }) => theme.colors.textPrimary};
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 4px;
  
  option {
    background-color: ${({ theme }) => theme.colors.background};
  }
`;

const Settings = () => {
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.auth.settings || {});
  const [localSettings, setLocalSettings] = useState({
    theme: settings.theme || 'dark',
    language: settings.language || 'en',
    notifications: settings.notifications !== false,
    soundEffects: settings.soundEffects !== false,
    sendReadReceipts: settings.sendReadReceipts !== false,
    autoDownload: settings.autoDownload || 'wifi',
    storageLimit: settings.storageLimit || '1GB',
    deleteMessagesAfter: settings.deleteMessagesAfter || 'never',
  });
  const [updateStatus, setUpdateStatus] = useState({ loading: false, error: null, success: false });

  const handleToggle = (setting) => {
    setLocalSettings({
      ...localSettings,
      [setting]: !localSettings[setting]
    });
  };
  
  const handleChange = (setting, value) => {
    setLocalSettings({
      ...localSettings,
      [setting]: value
    });
  };
  
  const handleSaveSettings = async () => {
    try {
      setUpdateStatus({ loading: true, error: null, success: false });
      
      const response = await api.put('/users/settings', localSettings);
      
      if (response.data.success) {
        dispatch(updateSettings(localSettings));
        
        setUpdateStatus({ loading: false, error: null, success: true });
        
        // Reset success status after 3 seconds
        setTimeout(() => {
          setUpdateStatus(prev => ({ ...prev, success: false }));
        }, 3000);
      }
    } catch (error) {
      setUpdateStatus({ 
        loading: false, 
        error: error.response?.data?.message || 'Failed to update settings', 
        success: false 
      });
    }
  };

  return (
    <SettingsContainer>
      <SettingsHeader>
        <div>
          <SettingsTitle>Settings</SettingsTitle>
          <SettingsDescription>Customize your Murmur experience</SettingsDescription>
        </div>
      </SettingsHeader>
      
      <CardGrid>
        {/* Appearance & Language */}
        <Card>
          <CardHeader divider>
            <CardTitle>Appearance & Language</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingOption>
              <OptionText>
                <OptionTitle>Theme</OptionTitle>
                <OptionDescription>Choose between light and dark mode</OptionDescription>
              </OptionText>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <FiSun style={{ marginRight: '8px' }} />
                <Toggle>
                  <input 
                    type="checkbox" 
                    checked={localSettings.theme === 'dark'}
                    onChange={() => handleChange('theme', localSettings.theme === 'dark' ? 'light' : 'dark')}
                  />
                  <span />
                </Toggle>
                <FiMoon style={{ marginLeft: '8px' }} />
              </div>
            </SettingOption>
            
            <SettingOption>
              <OptionText>
                <OptionTitle>Language</OptionTitle>
                <OptionDescription>Select your preferred language</OptionDescription>
              </OptionText>
              <Select 
                value={localSettings.language}
                onChange={(e) => handleChange('language', e.target.value)}
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
                <option value="pt">Português</option>
                <option value="ru">Русский</option>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
              </Select>
            </SettingOption>
          </CardContent>
        </Card>
        
        {/* Notifications */}
        <Card>
          <CardHeader divider>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingOption>
              <OptionText>
                <OptionTitle>Enable Notifications</OptionTitle>
                <OptionDescription>Receive notifications for new messages</OptionDescription>
              </OptionText>
              <Toggle>
                <input 
                  type="checkbox" 
                  checked={localSettings.notifications}
                  onChange={() => handleToggle('notifications')}
                />
                <span />
              </Toggle>
            </SettingOption>
            
            <SettingOption>
              <OptionText>
                <OptionTitle>Sound Effects</OptionTitle>
                <OptionDescription>Play sounds for messages and calls</OptionDescription>
              </OptionText>
              <Toggle>
                <input 
                  type="checkbox" 
                  checked={localSettings.soundEffects}
                  onChange={() => handleToggle('soundEffects')}
                />
                <span />
              </Toggle>
            </SettingOption>
          </CardContent>
        </Card>
        
        {/* Privacy */}
        <Card>
          <CardHeader divider>
            <CardTitle>Privacy</CardTitle>
            <FiShield style={{ marginLeft: '8px', opacity: 0.7 }} />
          </CardHeader>
          <CardContent>
            <SettingOption>
              <OptionText>
                <OptionTitle>Read Receipts</OptionTitle>
                <OptionDescription>Let others know when you've read their messages</OptionDescription>
              </OptionText>
              <Toggle>
                <input 
                  type="checkbox" 
                  checked={localSettings.sendReadReceipts}
                  onChange={() => handleToggle('sendReadReceipts')}
                />
                <span />
              </Toggle>
            </SettingOption>
            
            <SettingOption>
              <OptionText>
                <OptionTitle>Auto Delete Messages</OptionTitle>
                <OptionDescription>Automatically delete messages after a specified time</OptionDescription>
              </OptionText>
              <Select 
                value={localSettings.deleteMessagesAfter}
                onChange={(e) => handleChange('deleteMessagesAfter', e.target.value)}
              >
                <option value="never">Never</option>
                <option value="1d">1 Day</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="90d">90 Days</option>
                <option value="1y">1 Year</option>
              </Select>
            </SettingOption>
            
            <SettingOption>
              <OptionText>
                <OptionTitle>Default Region</OptionTitle>
                <OptionDescription>Set your default region for connection</OptionDescription>
              </OptionText>
              <Select 
                value={localSettings.region || 'auto'}
                onChange={(e) => handleChange('region', e.target.value)}
              >
                <option value="auto">Auto-select</option>
                <option value="us">North America</option>
                <option value="eu">Europe</option>
                <option value="as">Asia</option>
                <option value="oc">Oceania</option>
              </Select>
            </SettingOption>
          </CardContent>
        </Card>
        
        {/* Data & Storage */}
        <Card>
          <CardHeader divider>
            <CardTitle>Data & Storage</CardTitle>
            <FiDatabase style={{ marginLeft: '8px', opacity: 0.7 }} />
          </CardHeader>
          <CardContent>
            <SettingOption>
              <OptionText>
                <OptionTitle>Auto-download Media</OptionTitle>
                <OptionDescription>When to automatically download media files</OptionDescription>
              </OptionText>
              <Select 
                value={localSettings.autoDownload}
                onChange={(e) => handleChange('autoDownload', e.target.value)}
              >
                <option value="always">Always</option>
                <option value="wifi">Wi-Fi Only</option>
                <option value="never">Never</option>
              </Select>
            </SettingOption>
            
            <SettingOption>
              <OptionText>
                <OptionTitle>Storage Limit</OptionTitle>
                <OptionDescription>Maximum storage space for offline messages</OptionDescription>
              </OptionText>
              <Select 
                value={localSettings.storageLimit}
                onChange={(e) => handleChange('storageLimit', e.target.value)}
              >
                <option value="250MB">250 MB</option>
                <option value="500MB">500 MB</option>
                <option value="1GB">1 GB</option>
                <option value="2GB">2 GB</option>
                <option value="5GB">5 GB</option>
              </Select>
            </SettingOption>
            
            <Button 
              variant="outlined"
              color="error"
              fullWidth
              style={{ marginTop: '16px' }}
            >
              Clear All Local Data
            </Button>
          </CardContent>
        </Card>
      </CardGrid>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
        <Button
          variant="contained"
          onClick={handleSaveSettings}
          disabled={updateStatus.loading}
          startIcon={<FiSave />}
          size="large"
        >
          {updateStatus.loading ? 'Saving...' : 'Save All Settings'}
        </Button>
        
        {updateStatus.success && (
          <span style={{ color: 'green', marginLeft: '12px', alignSelf: 'center' }}>
            Settings updated successfully!
          </span>
        )}
        
        {updateStatus.error && (
          <span style={{ color: 'red', marginLeft: '12px', alignSelf: 'center' }}>
            {updateStatus.error}
          </span>
        )}
      </div>
    </SettingsContainer>
  );
};

export default Settings;