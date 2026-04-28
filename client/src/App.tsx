import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './components/WalletProvider';
import { Layout } from './components/Layout/Layout';
import { Home } from './pages/Home';
import { Jobs } from './pages/Jobs';
import { PostJob } from './pages/PostJob';
import { Dashboard } from './pages/Dashboard';

function App() {
  return (
    <WalletProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/post-job" element={<PostJob />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </Layout>
      </Router>
    </WalletProvider>
  );
}

export default App;