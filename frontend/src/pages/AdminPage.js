import React, { useState, useEffect } from 'react';
import { useToast } from '../components/ToastNotification';
import { useLanguage } from '../LanguageContext';
import { fetchUsers, updateUserRole, deleteUser } from '../services/apiService'; // Import new functions
import { useAuth } from '../AuthContext'; // Import useAuth

export default function AdminPage() {
  const { t } = useLanguage();
  const { user: loggedInUser } = useAuth(); // Get loggedInUser from AuthContext
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('user-management');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const tabs = ['user-management', 'chat-settings', 'admin-settings'];
    tabs.forEach(tab => {
      const tabButton = document.getElementById(`${tab}-tab`);
      const tabContent = document.getElementById(tab);
      if (tabButton && tabContent) {
        if (activeTab === tab) {
          tabButton.classList.add('text-blue-600', 'border-blue-600', 'dark:text-blue-500', 'dark:border-blue-500');
          tabButton.classList.remove('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'dark:hover:text-gray-300');
          tabButton.setAttribute('aria-selected', 'true');
          tabContent.classList.remove('hidden');
        } else {
          tabButton.classList.remove('text-blue-600', 'border-blue-600', 'dark:text-blue-500', 'dark:border-blue-500');
          tabButton.classList.add('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'dark:hover:text-gray-300');
          tabButton.setAttribute('aria-selected', 'false');
          tabContent.classList.add('hidden');
        }
      }
    });
  }, [activeTab]);

  useEffect(() => {
    const getUsers = async () => {
      try {
        setLoading(true);
        const response = await fetchUsers();
        setUsers(response.data);
      } catch (err) {
        setError(err);
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'user-management' && loggedInUser) { // Only fetch if user is authenticated
      getUsers();
    }
  }, [activeTab, loggedInUser]); // Add loggedInUser to dependency array

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      setUsers(prevUsers =>
        prevUsers.map(u => (u.id === userId ? { ...u, role: newRole } : u))
      );
      showToast(`User role updated to ${newRole}`, 'success');
    } catch (err) {
      setError(err);
      console.error("Failed to update user role:", err);
      showToast(`Failed to update user role: ${err.message}`, 'error');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    try {
      await deleteUser(userId);
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
      showToast(`User ${username} deleted successfully.`, 'success');
    } catch (err) {
      setError(err);
      console.error("Failed to delete user:", err);
      showToast(`Failed to delete user: ${err.message}`, 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain p-8 transition-colors duration-300 bg-background text-text-primary">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 text-text-primary">{t.adminPanelTitle || "Admin Panel"}</h1>
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700">
          <ul className="flex flex-wrap -mb-px text-sm font-medium text-center" id="admin-tabs" role="tablist">
            <li className="me-2" role="presentation">
              <button
                className="inline-block p-4 border-b-2 rounded-t-lg"
                id="user-management-tab"
                type="button"
                role="tab"
                aria-controls="user-management"
                aria-selected={activeTab === 'user-management'}
                onClick={() => handleTabClick('user-management')}
              >
                {t.userManagement || "User Management"}
              </button>
            </li>
            <li className="me-2" role="presentation">
              <button
                className="inline-block p-4 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300"
                id="chat-settings-tab"
                type="button"
                role="tab"
                aria-controls="chat-settings"
                aria-selected={activeTab === 'chat-settings'}
                onClick={() => handleTabClick('chat-settings')}
              >
                {t.chatSettings || "Chat Settings"}
              </button>
            </li>
            <li className="me-2" role="presentation">
              <button
                className="inline-block p-4 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300"
                id="admin-settings-tab"
                type="button"
                role="tab"
                aria-controls="admin-settings"
                aria-selected={activeTab === 'admin-settings'}
                onClick={() => handleTabClick('admin-settings')}
              >
                {t.adminSettings || "Admin Settings"}
              </button>
            </li>
          </ul>
        </div>
        <div id="admin-tab-content">
          <div className={`${activeTab === 'user-management' ? 'block' : 'hidden'} p-4 rounded-lg bg-gray-50 dark:bg-gray-800`} id="user-management" role="tabpanel" aria-labelledby="user-management-tab">
            <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.userManagement || "User Management"}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-6 py-3">User Info</th>
                    <th scope="col" className="px-6 py-3">User ID</th>
                    <th scope="col" className="px-6 py-3">Role</th>
                    <th scope="col" className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center">Loading users...</td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-red-500">Error: {error.message}</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center">No users found.</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700"><td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                          <div>{user.name}</div>
                          <div className="text-gray-500 text-xs">{user.email}</div>
                        </td><td className="px-6 py-2 text-xs">{user.id}</td><td className="px-6 py-2">
                          <div className="flex items-center space-x-2">
                            <select
                              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 align-middle"
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              disabled={loggedInUser && loggedInUser.id === user.id}
                            >
                              <option value="User">User</option>
                              <option value="Admin">Admin</option>
                            </select>
                          </div>
                        </td><td className="px-6 py-2">
                          <button
                            className="font-medium text-red-600 dark:text-red-500"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                          >
                            Delete
                          </button>
                        </td></tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={`${activeTab === 'chat-settings' ? 'block' : 'hidden'} p-4 rounded-lg bg-gray-50 dark:bg-gray-800`} id="chat-settings" role="tabpanel" aria-labelledby="chat-settings-tab">
            <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.chatSettings || "Chat Settings"}</h2>
            <p className="text-lg text-text-secondary">
              {t.chatSettingsPlaceholder || "Placeholder for Chat Settings."}
            </p>
          </div>
          <div className={`${activeTab === 'admin-settings' ? 'block' : 'hidden'} p-4 rounded-lg bg-gray-50 dark:bg-gray-800`} id="admin-settings" role="tabpanel" aria-labelledby="admin-settings-tab">
            <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.adminSettings || "Admin Settings"}</h2>
            <p className="text-lg text-text-secondary">
              {t.adminSettingsPlaceholder || "Placeholder for Admin Settings."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}