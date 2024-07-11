import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Schedules from './pages/Schedules';
import DoctorAppointment from './pages/DoctorAppointment';
import Login from './pages/Register';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    // Clear local storage, reset state, etc.
    setIsLoggedIn(false);
  };

  return (
    <Router>
      <div>
        <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} />
        <div className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/doctor-appointment" element={<DoctorAppointment />} />
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
