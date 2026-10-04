import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GOOGLE_CLIENT_ID } from './lib/helpers/google'
import './main.css'
import App from './App.jsx'

const app = <BrowserRouter><App /></BrowserRouter>

// Only load Google's script when a client ID is configured; without one the Google buttons hide themselves.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {GOOGLE_CLIENT_ID ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{app}</GoogleOAuthProvider> : app}
  </StrictMode>,
)
