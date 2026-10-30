// Mounts the login gate and application into the page.
import React from 'react';
import { createRoot } from 'react-dom/client';
import Gate from './Gate.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<Gate />);
