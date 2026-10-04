import { Route, Routes } from 'react-router';
import { useState, useEffect } from 'react';
import NavBar from './components/layout/NavBar';
import SignInForm from './components/auth/SignInForm';
import SignUpForm from './components/auth/SignUpForm';
import HomePage from './pages/HomePage';
import GroupsPage from './pages/GroupsPage';
import SportsPage from './pages/SportsPage';
import * as authService from './services/authService';
import { initialSession, watchUser, authenticate, signOut } from './lib/helpers/auth';
import './App.css';

export default function App() {
  const [account, setAccount] = useState(initialSession);
  useEffect(() => watchUser(setAccount), []);
  const session = {
    ...account, signOut,
    signIn: body => authenticate(authService.signIn, body, setAccount),
    signUp: body => authenticate(authService.signUp, body, setAccount),
  };
  const accountKey = account.user?.id || 'guest';
  return <>
    <NavBar session={session} />
    <Routes>
      <Route path="/" element={<HomePage key={accountKey} session={session} />} />
      <Route path="/groups" element={<GroupsPage key={accountKey} session={session} />} />
      <Route path="/sports" element={<SportsPage key={accountKey} session={session} />} />
      <Route path="/sign-in" element={<SignInForm session={session} />} />
      <Route path="/sign-up" element={<SignUpForm session={session} />} />
      <Route path="*" element={<main><h1>Page not found</h1><p>Use the navigation to return to a working page.</p></main>} />
    </Routes>
  </>;
}
