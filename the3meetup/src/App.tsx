import { Routes, Route, Navigate } from 'react-router-dom';
import TouchLivePage from './pages/TouchLivePage';
import LoadingPage from './pages/LoadingPage';
import AdminPage from './pages/AdminPage';
import ReviewPage from './pages/ReviewPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/loading" replace />} />
      <Route path="/loading" element={<LoadingPage />} />
      <Route path="/touchlive" element={<TouchLivePage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/review" element={<ReviewPage />} />
    </Routes>
  );
}

export default App;

