import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import ShiancoChatHeader from '../components/ShiancoChatHeader';
import ThemeToggle from '../components/ThemeToggle';
import EyeIcon from '../components/icons/EyeIcon';
import { validateEmail, validatePassword, getPasswordStrength } from '../utils/validation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Department enum values expected by backend
  const [department, setDepartment] = useState('senior_management');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const passwordStrength = getPasswordStrength(password);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (value) {
      const result = validateEmail(value);
      setEmailError(result.valid ? '' : result.error);
    } else {
      setEmailError('');
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    if (value) {
      const result = validatePassword(value);
      setPasswordError(result.valid ? '' : result.error);
    } else {
      setPasswordError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate all fields before submission
    const emailResult = validateEmail(email);
    const passwordResult = validatePassword(password);

    if (!emailResult.valid) {
      setEmailError(emailResult.error);
      return;
    }
    if (!passwordResult.valid) {
      setPasswordError(passwordResult.error);
      return;
    }
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      await register({ name, email, password, department });
      navigate('/login');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'Failed to register. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="relative w-full max-w-md p-8 space-y-6 bg-surface rounded-lg shadow-lg">
        <div className="flex justify-center">
          <ShiancoChatHeader iconClassName="w-12 h-12" textClassName="text-4xl" />
        </div>
        <h1 className="text-2xl font-bold text-center text-text-primary">Create Account</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="text-sm font-medium text-text-secondary"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border rounded-md bg-input border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
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
              onChange={handleEmailChange}
              required
              autoComplete="username"
              className={`w-full px-3 py-2 mt-1 border rounded-md bg-input border-border focus:outline-none focus:ring-2 ${emailError ? 'border-red-500 focus:ring-red-500' : 'focus:ring-primary'}`}
            />
            {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
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
                onChange={handlePasswordChange}
                required
                autoComplete="new-password"
                className={`w-full px-3 py-2 mt-1 border rounded-md bg-input border-border focus:outline-none focus:ring-2 ${passwordError ? 'border-red-500 focus:ring-red-500' : 'focus:ring-primary'}`}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
                onClick={() => setShowPassword(!showPassword)}
              >
                <EyeIcon isOpen={showPassword} />
              </button>
            </div>
            {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
            {password && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: passwordStrength.width }}
                    />
                  </div>
                  <span className="text-xs text-text-secondary">{passwordStrength.label}</span>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  Min 12 chars, uppercase, lowercase, number, special char
                </p>
              </div>
            )}
          </div>
          <div>
            <label
              htmlFor="department"
              className="text-sm font-medium text-text-secondary"
            >
              Department
            </label>
            <select
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border rounded-md bg-input border-border focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="senior_management">高层管理</option>
              <option value="general_office">总经办</option>
              <option value="xishan_home">锡山家居</option>
              <option value="kaka_time">咖咖时光</option>
              <option value="agio_business">Agio 业务</option>
              <option value="agio_rd">Agio 研发</option>
              <option value="production_dept">生产事业部</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            className="w-full px-4 py-2 font-semibold text-text-primary dark:text-white rounded-md bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Create Account
          </button>
        </form>
        <p className="text-sm text-center text-text-secondary">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="font-medium text-primary hover:underline">
            Log in
          </button>
        </p>
        <div className="absolute bottom-4 right-4">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
