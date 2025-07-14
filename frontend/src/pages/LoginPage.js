import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import ShiancoChatHeader from '../components/ShiancoChatHeader';
import ThemeToggle from '../components/ThemeToggle';
import EyeIcon from '../components/icons/EyeIcon';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Failed to log in. Please check your credentials.');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="relative w-full max-w-md p-8 space-y-6 bg-surface rounded-lg shadow-lg">
        <div className="flex justify-center">
          <ShiancoChatHeader iconClassName="w-12 h-12" textClassName="text-4xl" />
        </div>
        <h1 className="text-2xl font-bold text-center text-text-primary">Login</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-text-secondary"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-3 py-2 mt-1 border rounded-md bg-input border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-text-secondary"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 mt-1 border rounded-md bg-input border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
                onClick={() => setShowPassword(!showPassword)}
              >
                <EyeIcon isOpen={showPassword} />
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            className="w-full px-4 py-2 font-semibold text-text-primary dark:text-white rounded-md bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Log In
          </button>
        </form>
        <p className="text-sm text-center text-text-secondary">
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="font-medium text-primary hover:underline">
            Sign up
          </button>
        </p>
        <div className="absolute bottom-4 right-4">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}