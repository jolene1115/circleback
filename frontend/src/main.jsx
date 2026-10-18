import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import AmbientMusic from './AmbientMusic.jsx';
import {feedbackPreview} from './feedback-preview.js';

import {selectSession} from './store.js';

// /?preview=feedback shows the summary page with sample data (no API calls).
if (new URLSearchParams(location.search).get('preview') === 'feedback') selectSession(feedbackPreview);
createRoot(document.getElementById('root')).render(<><App /><AmbientMusic /></>);
