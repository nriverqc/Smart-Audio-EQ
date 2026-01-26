import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Premium from './pages/Premium';

export default function App() {
  return (
    <BrowserRouter>
      <div className="container">
        <nav>
          <Link to="/" style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#00d2ff'}}>Smart Audio EQ</Link>
          <div>
            <Link to="/" style={{marginRight: '20px'}}>Home</Link>
            <Link to="/premium" className="btn-premium">Go Premium</Link>
          </div>
        </nav>
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/premium" element={<Premium />} />
        </Routes>

        <footer>
          <p>© 2026 Smart Audio EQ. All rights reserved.</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
