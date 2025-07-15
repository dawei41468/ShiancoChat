import React, { useState, useContext, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { AuthContext } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { updateUser, deleteAccount } from '../services/apiService';
import { useNavigate } from 'react-router-dom';

export default function ProfileSettings() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [userName, setUserName] = useState('');
  const { user, setUser, logout } = useContext(AuthContext);
  const userEmail = user ? user.email : 'N/A';

  useEffect(() => {
    if (user && user.name) {
      setUserName(user.name);
    }
  }, [user]);

  const handleUserNameChange = (event) => {
    setUserName(event.target.value);
  };

  const handleSaveUserName = async () => {
    console.log('Attempting to save user name:', userName);
    console.log('Authorization header before update:', localStorage.getItem('token')); // Directly check localStorage token
    try {
      const response = await updateUser({ name: userName });
      setUser(response.data); // Update user in AuthContext
      alert('User name updated successfully!');
    } catch (error) {
      console.error('Failed to update user name:', error);
      alert('Failed to update user name. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm(t.confirmDeleteAccount || 'Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        await deleteAccount();
        logout(); // Clear user session
        alert(t.accountDeletedSuccessfully || 'Account deleted successfully!');
        navigate('/login'); // Redirect to login page
      } catch (error) {
        console.error('Failed to delete account:', error);
        alert(t.failedToDeleteAccount || 'Failed to delete account. Please try again.');
      }
    }
  };

  return (
    <section className="mb-5 p-6 rounded-lg border border-border bg-surface">
      <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.userProfile || "User Profile"}</h2>
      <div className="space-y-4">
        {/* User Email (fixed) */}
        <div>
          <p className="block text-text-secondary text-sm font-semibold mb-2">
            {t.userEmail || "User Email"}
          </p>
          <p className={`p-3 rounded-lg border border-border ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'} text-text-primary`}>
            {userEmail}
          </p>
        </div>

        {/* User Name (editable) */}
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <label htmlFor="userName" className="block text-text-secondary text-sm font-semibold mb-2">
              {t.editName || "Edit Name"}
            </label>
            <input
              type="text"
              id="userName"
              className={`w-full py-2 px-3 rounded-lg border border-border ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'} text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-gradient`}
              value={userName}
              onChange={handleUserNameChange}
              placeholder={t.currentUserNamePlaceholder || "Current User Name"}
            />
          </div>
          <button
            className="px-6 py-2 rounded-lg font-semibold transition-colors bg-purple-gradient text-white hover:opacity-90"
            onClick={handleSaveUserName}
          >
            {t.save || "Save"}
          </button>
        </div>

        {/* Delete Account Button */}
        <div className="pt-4 border-t border-border">
          <button
            className="px-6 py-2 rounded-lg font-semibold transition-colors bg-red-600 text-white hover:bg-red-700"
            onClick={handleDeleteAccount}
          >
            {t.deleteAccount || "Delete Account"}
          </button>
        </div>
      </div>
    </section>
  );
}