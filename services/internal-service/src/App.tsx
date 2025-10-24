import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { GatewayService } from './pages/GatewayService';
import { AskService } from './pages/AskService';
import { SearchService } from './pages/SearchService';
import { EmbedService } from './pages/EmbedService';
import { QueryOptimizerService } from './pages/QueryOptimizerService';
import { HealthCheck } from './pages/HealthCheck';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<GatewayService />} />
          <Route path="/ask" element={<AskService />} />
          <Route path="/search" element={<SearchService />} />
          <Route path="/embed" element={<EmbedService />} />
          <Route path="/optimizer" element={<QueryOptimizerService />} />
          <Route path="/health" element={<HealthCheck />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
