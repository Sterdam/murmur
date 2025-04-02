import React from 'react';
import ReactDOM from 'react-dom/client';
import styled from 'styled-components';

// Styles
const AppContainer = styled.div`
  background-color: #121212;
  color: white;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'Roboto', 'Segoe UI', sans-serif;
  text-align: center;
`;

const Header = styled.h1`
  font-size: 3rem;
  margin-bottom: 1rem;
  background: linear-gradient(90deg, #7928CA, #FF0080);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const Description = styled.p`
  font-size: 1.2rem;
  max-width: 600px;
  line-height: 1.6;
  margin-bottom: 2rem;
  color: rgba(255, 255, 255, 0.8);
`;

const Card = styled.div`
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 2rem;
  width: 80%;
  max-width: 500px;
  margin: 1rem 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
`;

const Feature = styled.div`
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const FeatureTitle = styled.h3`
  margin-bottom: 0.5rem;
  color: #FF0080;
`;

const Button = styled.button`
  background: linear-gradient(90deg, #7928CA, #FF0080);
  border: none;
  color: white;
  padding: 12px 24px;
  border-radius: 24px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  margin-top: 2rem;
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 0, 128, 0.4);
  }
`;

// Main App
const App = () => {
  return (
    <AppContainer>
      <Header>Murmur</Header>
      <Description>
        Une messagerie sécurisée, respectueuse de votre vie privée et chiffrée de bout en bout.
      </Description>
      
      <Card>
        <Feature>
          <FeatureTitle>Chiffrement de bout en bout</FeatureTitle>
          <p>Vos messages sont protégés et ne peuvent être lus que par vous et vos destinataires.</p>
        </Feature>
        
        <Feature>
          <FeatureTitle>Zéro collecte de données</FeatureTitle>
          <p>Aucune information personnelle n'est collectée pour garantir votre anonymat.</p>
        </Feature>
        
        <Feature>
          <FeatureTitle>Open Source</FeatureTitle>
          <p>Code transparent et vérifiable par la communauté.</p>
        </Feature>
      </Card>
      
      <Button>Commencer</Button>
    </AppContainer>
  );
};

// Initialize the application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);