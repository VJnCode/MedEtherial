import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Schedules from './pages/Schedules';
import DoctorAppointment from './pages/DoctorAppointment';

const App = () => {
  return (
    <Router>
      <div>
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/doctor-appointment" element={<DoctorAppointment />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};


export default App;
