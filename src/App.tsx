import React from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { RegisterPage } from './components/RegisterPage';
import { StoreSelectPage } from './components/StoreSelectPage';
import { DashboardPage } from './components/DashboardPage';

const AppContent: React.FC = () => {
  const { user } = useInventory();

  if (!user) {
    return <RegisterPage />;
  }

  if (!user.selectedStore) {
    return <StoreSelectPage />;
  }

  return <DashboardPage />;
};

function App() {
  return (
    <InventoryProvider>
      <div className="app-container">
        <AppContent />
      </div>
    </InventoryProvider>
  );
}

export default App;
