import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { GatewayService } from './pages/GatewayService';
import { AskService } from './pages/AskService';
import { SearchService } from './pages/SearchService';
import { EmbedService } from './pages/EmbedService';
import { QueryOptimizerService } from './pages/QueryOptimizerService';
import { HealthCheck } from './pages/HealthCheck';
import { BooksLibrary } from './pages/BooksLibrary';
import { BookViewer } from './pages/BookViewer';

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
          <Route path="/books" element={<BooksLibrary />} />
          <Route path="/books/:id" element={<BookViewer />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
