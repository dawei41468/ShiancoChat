import React, { useState, useEffect } from 'react';
import { useToast } from '../components/ToastNotification';
import { useLanguage } from '../LanguageContext';
import { fetchToolAuditEvents, fetchTools, fetchUsers, updateTool, updateUserRole, deleteUser, fetchAssistants, createAssistant, updateAssistant, deleteAssistant } from '../services/apiService';
import { DEPARTMENTS, getDepartmentLabel } from '../utils/departments';
import { useAuth } from '../AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const TABS = [
  { id: 'user-management', labelKey: 'userManagement' },
  { id: 'assistants', labelKey: 'assistants' },
  { id: 'tool-governance', labelKey: 'toolGovernance' },
  { id: 'admin-settings', labelKey: 'adminSettings' },
];

const ASSISTANT_ICON_OPTIONS = ['Bot', 'Sparkles', 'FileText', 'ClipboardList', 'Mail', 'ListChecks'];
const ASSISTANT_POLICY_OPTIONS = ['fast', 'balanced', 'deep', 'local'];

const EMPTY_ASSISTANT_FORM = {
  name: '',
  name_zh: '',
  description: '',
  description_zh: '',
  department: '',
  icon: 'Bot',
  model_policy: 'balanced',
  system_prompt: '',
  output_template: '',
};

function getTabButtonClasses(isActive) {
  const base = 'inline-block p-4 border-b-2 rounded-t-lg transition-colors';
  if (isActive) {
    return `${base} text-blue-600 border-blue-600 dark:text-blue-500 dark:border-blue-500`;
  }
  return `${base} border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300`;
}

  const handleCancelDelete = () => {
    setDeleteUserId(null);
    setDeleteUsername('');
  };

export default function AdminPage() {
  const { t } = useLanguage();
  const { user: loggedInUser } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('user-management');
  const [users, setUsers] = useState([]);
  const [tools, setTools] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toolLoading, setToolLoading] = useState(false);
  const [error, setError] = useState(null);
  const [auditFilterTool, setAuditFilterTool] = useState('');
  const [auditFilterStatus, setAuditFilterStatus] = useState('');
  const [auditFilterUser, setAuditFilterUser] = useState('');
  const [auditFilterDate, setAuditFilterDate] = useState('');
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleteUsername, setDeleteUsername] = useState('');
  const [assistants, setAssistants] = useState([]);
  const [assistantsLoading, setAssistantsLoading] = useState(false);
  const [assistantForm, setAssistantForm] = useState(EMPTY_ASSISTANT_FORM);
  const [assistantSaving, setAssistantSaving] = useState(false);
  const [deleteAssistantTarget, setDeleteAssistantTarget] = useState(null);

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

    if (activeTab === 'user-management' && loggedInUser) {
      getUsers();
    }
  }, [activeTab, loggedInUser]);

  useEffect(() => {
    const loadToolGovernance = async () => {
      try {
        setToolLoading(true);
        const [toolResponse, auditResponse] = await Promise.all([
          fetchTools(),
          fetchToolAuditEvents(),
        ]);
        setTools(toolResponse.data || []);
        setAuditEvents(auditResponse.data || []);
      } catch (err) {
        setError(err);
        console.error("Failed to fetch tool governance:", err);
      } finally {
        setToolLoading(false);
      }
    };

    if (activeTab === 'tool-governance' && loggedInUser) {
      loadToolGovernance();
    }
  }, [activeTab, loggedInUser]);

  useEffect(() => {
    const loadAssistants = async () => {
      try {
        setAssistantsLoading(true);
        const response = await fetchAssistants();
        setAssistants(response.data || []);
      } catch (err) {
        setError(err);
        console.error("Failed to fetch assistants:", err);
      } finally {
        setAssistantsLoading(false);
      }
    };

    if (activeTab === 'assistants' && loggedInUser) {
      loadAssistants();
    }
  }, [activeTab, loggedInUser]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      setUsers(prevUsers =>
        prevUsers.map(u => (u.id === userId ? { ...u, role: newRole } : u))
      );
      showToast(t.roleUpdatedSuccess.replace('{role}', newRole), 'success');
    } catch (err) {
      setError(err);
      console.error("Failed to update user role:", err);
      showToast(`Failed to update user role: ${err.message}`, 'error');
    }
  };

  const handleDeleteUser = (userId, username) => {
    setDeleteUserId(userId);
    setDeleteUsername(username);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      await deleteUser(deleteUserId);
      setUsers(prevUsers => prevUsers.filter(u => u.id !== deleteUserId));
      showToast(t.userDeletedSuccess.replace('{username}', deleteUsername), 'success');
    } catch (err) {
      setError(err);
      console.error("Failed to delete user:", err);
      showToast(`Failed to delete user: ${err.message}`, 'error');
    } finally {
      setDeleteUserId(null);
      setDeleteUsername('');
    }
  };

  const handleToolEnabledChange = async (tool, enabled) => {
    try {
      const response = await updateTool(tool.id, { enabled });
      setTools(prevTools => prevTools.map(item => item.id === tool.id ? response.data : item));
      showToast(`${tool.label} ${enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      setError(err);
      console.error("Failed to update tool:", err);
      showToast(`Failed to update tool: ${err.message}`, 'error');
    }
  };

  const handleRoleToggle = async (tool, role) => {
    const currentRoles = tool.allowed_roles || [];
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter(item => item !== role)
      : [...currentRoles, role];
    try {
      const response = await updateTool(tool.id, { allowed_roles: nextRoles });
      setTools(prevTools => prevTools.map(item => item.id === tool.id ? response.data : item));
      showToast(`${tool.label} permissions updated`, 'success');
    } catch (err) {
      setError(err);
      console.error("Failed to update tool roles:", err);
      showToast(`Failed to update tool roles: ${err.message}`, 'error');
    }
  };

  const handleAssistantEnabledChange = async (assistant, enabled) => {
    try {
      const response = await updateAssistant(assistant.id, { enabled });
      setAssistants(prev => prev.map(item => (item.id === assistant.id ? response.data : item)));
      showToast(`${assistant.name} ${enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      setError(err);
      console.error("Failed to update assistant:", err);
      showToast(`Failed to update assistant: ${err.message}`, 'error');
    }
  };

  const handleCreateAssistant = async (event) => {
    event.preventDefault();
    if (!assistantForm.name.trim()) return;
    setAssistantSaving(true);
    try {
      const payload = {
        name: assistantForm.name.trim(),
        name_zh: assistantForm.name_zh.trim() || null,
        description: assistantForm.description.trim() || null,
        description_zh: assistantForm.description_zh.trim() || null,
        department: assistantForm.department || null,
        icon: assistantForm.icon || 'Bot',
        model_policy: assistantForm.model_policy || 'balanced',
        system_prompt: assistantForm.system_prompt,
        output_template: assistantForm.output_template.trim() || null,
      };
      const response = await createAssistant(payload);
      setAssistants(prev => [...prev, response.data]);
      setAssistantForm(EMPTY_ASSISTANT_FORM);
      showToast(t.assistantCreatedSuccess ? t.assistantCreatedSuccess.replace('{name}', response.data.name) : `Created assistant: ${response.data.name}`, 'success');
    } catch (err) {
      setError(err);
      console.error("Failed to create assistant:", err);
      showToast(`Failed to create assistant: ${err.message}`, 'error');
    } finally {
      setAssistantSaving(false);
    }
  };

  const confirmDeleteAssistant = async () => {
    if (!deleteAssistantTarget) return;
    try {
      await deleteAssistant(deleteAssistantTarget.id);
      setAssistants(prev => prev.filter(item => item.id !== deleteAssistantTarget.id));
      showToast(t.assistantDeletedSuccess ? t.assistantDeletedSuccess.replace('{name}', deleteAssistantTarget.name) : `Deleted assistant: ${deleteAssistantTarget.name}`, 'success');
    } catch (err) {
      setError(err);
      console.error("Failed to delete assistant:", err);
      showToast(`Failed to delete assistant: ${err.message}`, 'error');
    } finally {
      setDeleteAssistantTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-text-secondary">{t.loadingUsers}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain p-8 transition-colors duration-300 bg-background text-text-primary">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 text-text-primary">{t.adminPanelTitle}</h1>
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700">
          <ul className="flex flex-wrap -mb-px text-sm font-medium text-center" role="tablist">
            {TABS.map((tab) => (
              <li key={tab.id} className="me-2" role="presentation">
                <button
                  className={getTabButtonClasses(activeTab === tab.id)}
                  type="button"
                  role="tab"
                  aria-controls={tab.id}
                  aria-selected={activeTab === tab.id}
                  onClick={() => handleTabClick(tab.id)}
                >
                  {t[tab.labelKey]}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div id="admin-tab-content">
          <div className={`${activeTab === 'user-management' ? 'block' : 'hidden'} p-4 rounded-lg bg-gray-50 dark:bg-gray-800`} id="user-management" role="tabpanel" aria-labelledby="user-management-tab">
            <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.userManagement}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-6 py-3">{t.userInfo}</th>
                    <th scope="col" className="px-6 py-3">{t.userId}</th>
                    <th scope="col" className="px-6 py-3">{t.role}</th>
                    <th scope="col" className="px-6 py-3">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center">{t.loadingUsers}</td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-red-500">Error: {error.message}</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center">{t.noUsersFound}</td>
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
                              <option value="User">{t.user}</option>
                              <option value="Admin">{t.admin}</option>
                            </select>
                          </div>
                        </td><td className="px-6 py-2">
                          <button
                            className="font-medium text-red-600 dark:text-red-500"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                          >
                            {t.delete}
                          </button>
                        </td></tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={`${activeTab === 'tool-governance' ? 'block' : 'hidden'} p-4 rounded-lg bg-gray-50 dark:bg-gray-800`} id="tool-governance" role="tabpanel" aria-labelledby="tool-governance-tab">
            <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.toolGovernance || 'Tool Governance'}</h2>
            {toolLoading ? (
              <p className="text-text-secondary">Loading tools...</p>
            ) : (
              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Tool</th>
                        <th className="px-4 py-3">Enabled</th>
                        <th className="px-4 py-3">Roles</th>
                        <th className="px-4 py-3">Default</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tools.map((tool) => (
                        <tr key={tool.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">{tool.label}</div>
                            <div className="text-xs text-gray-500">{tool.description}</div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={tool.enabled}
                              onChange={(event) => handleToolEnabledChange(tool, event.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {['User', 'Admin'].map((role) => (
                                <label key={role} className="inline-flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={(tool.allowed_roles || []).includes(role)}
                                    onChange={() => handleRoleToggle(tool, role)}
                                  />
                                  <span>{role}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">{tool.default_enabled ? 'On' : 'Off'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-text-primary">Recent Tool Events</h3>
                    <span className="text-xs text-text-secondary bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Latest 100</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
                    <select
                      className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                      value={auditFilterTool}
                      onChange={(e) => setAuditFilterTool(e.target.value)}
                    >
                      <option value="">All Tools</option>
                      {tools.map(tool => (
                        <option key={tool.id} value={tool.id}>{tool.label}</option>
                      ))}
                    </select>
                    <select
                      className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                      value={auditFilterStatus}
                      onChange={(e) => setAuditFilterStatus(e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      <option value="success">Success</option>
                      <option value="no_results">No Results</option>
                      <option value="fallback">Fallback</option>
                      <option value="error">Error</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Filter by user..."
                      className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                      value={auditFilterUser}
                      onChange={(e) => setAuditFilterUser(e.target.value)}
                    />
                    <input
                      type="date"
                      className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                      value={auditFilterDate}
                      onChange={(e) => setAuditFilterDate(e.target.value)}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Tool</th>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Latency</th>
                          <th className="px-4 py-3">Results</th>
                          <th className="px-4 py-3">Knowledge Space</th>
                          <th className="px-4 py-3">Assistant</th>
                          <th className="px-4 py-3">Conversation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filtered = auditEvents.filter(event => {
                            if (auditFilterTool && event.tool_id !== auditFilterTool) return false;
                            if (auditFilterStatus && event.status !== auditFilterStatus) return false;
                            if (auditFilterUser && !event.user_email?.toLowerCase().includes(auditFilterUser.toLowerCase())) return false;
                            if (auditFilterDate) {
                              const eventDate = new Date(event.created_at).toISOString().split('T')[0];
                              if (eventDate !== auditFilterDate) return false;
                            }
                            return true;
                          });
                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan="9" className="px-4 py-4 text-center">No tool events match the filters.</td>
                              </tr>
                            );
                          }
                          return filtered.map((event) => (
                            <tr key={event.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                              <td className="px-4 py-3 text-xs">{new Date(event.created_at).toLocaleString()}</td>
                              <td className="px-4 py-3">{event.tool_id}</td>
                              <td className="px-4 py-3">{event.user_email}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                  event.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                  event.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                  event.status === 'fallback' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {event.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">{typeof event.latency_ms === 'number' ? `${event.latency_ms}ms` : '-'}</td>
                              <td className="px-4 py-3">{event.details?.result_count ?? '-'}</td>
                              <td className="px-4 py-3 text-xs">{event.details?.knowledge_space_id || '-'}</td>
                              <td className="px-4 py-3 text-xs">{event.details?.assistant_id || '-'}</td>
                              <td className="px-4 py-3 text-xs truncate max-w-[120px]" title={event.conversation_id}>{event.conversation_id || '-'}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className={`${activeTab === 'assistants' ? 'block' : 'hidden'} p-4 rounded-lg bg-gray-50 dark:bg-gray-800`} id="assistants" role="tabpanel" aria-labelledby="assistants-tab">
            <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.assistants || 'Assistants'}</h2>

            <form onSubmit={handleCreateAssistant} className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">{t.createAssistant || 'Create Assistant'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={assistantForm.name}
                  onChange={(e) => setAssistantForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t.assistantNameEn || 'Name (EN)'}
                  required
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-text-primary"
                />
                <input
                  value={assistantForm.name_zh}
                  onChange={(e) => setAssistantForm(prev => ({ ...prev, name_zh: e.target.value }))}
                  placeholder={t.assistantNameZh || 'Name (ZH)'}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-text-primary"
                />
                <input
                  value={assistantForm.description}
                  onChange={(e) => setAssistantForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t.assistantDescEn || 'Description (EN)'}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-text-primary"
                />
                <input
                  value={assistantForm.description_zh}
                  onChange={(e) => setAssistantForm(prev => ({ ...prev, description_zh: e.target.value }))}
                  placeholder={t.assistantDescZh || 'Description (ZH)'}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-text-primary"
                />
                <select
                  value={assistantForm.department}
                  onChange={(e) => setAssistantForm(prev => ({ ...prev, department: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-text-primary"
                >
                  <option value="">{t.globalAssistant || 'Global (all departments)'}</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.value} value={dept.value}>{dept.labelEn} / {dept.labelZh}</option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <select
                    value={assistantForm.icon}
                    onChange={(e) => setAssistantForm(prev => ({ ...prev, icon: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-text-primary"
                  >
                    {ASSISTANT_ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                  <select
                    value={assistantForm.model_policy}
                    onChange={(e) => setAssistantForm(prev => ({ ...prev, model_policy: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-text-primary"
                  >
                    {ASSISTANT_POLICY_OPTIONS.map((policy) => (
                      <option key={policy} value={policy}>{policy}</option>
                    ))}
                  </select>
                </div>
              </div>
              <textarea
                value={assistantForm.system_prompt}
                onChange={(e) => setAssistantForm(prev => ({ ...prev, system_prompt: e.target.value }))}
                placeholder={t.systemPrompt || 'System prompt'}
                className="w-full h-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-text-primary resize-y"
              />
              <textarea
                value={assistantForm.output_template}
                onChange={(e) => setAssistantForm(prev => ({ ...prev, output_template: e.target.value }))}
                placeholder={t.outputTemplate || 'Output template (optional)'}
                className="w-full h-16 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-text-primary resize-y"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!assistantForm.name.trim() || assistantSaving}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {assistantSaving ? (t.saving || 'Saving...') : (t.createAssistant || 'Create Assistant')}
                </button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">{t.assistantName || 'Assistant'}</th>
                    <th scope="col" className="px-4 py-3">{t.departmentLabel || 'Department'}</th>
                    <th scope="col" className="px-4 py-3">{t.modelPolicy || 'Policy'}</th>
                    <th scope="col" className="px-4 py-3">{t.enabledLabel || 'Enabled'}</th>
                    <th scope="col" className="px-4 py-3">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {assistantsLoading ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-4 text-center">{t.loadingAssistants || 'Loading assistants...'}</td>
                    </tr>
                  ) : assistants.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-4 text-center">{t.noAssistantsFound || 'No assistants found'}</td>
                    </tr>
                  ) : (
                    assistants.map((assistant) => (
                      <tr key={assistant.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                          <div>{assistant.name}</div>
                          {assistant.name_zh && <div className="text-gray-500 text-xs">{assistant.name_zh}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {assistant.department
                            ? `${getDepartmentLabel(assistant.department, 'EN')} / ${getDepartmentLabel(assistant.department, 'CN')}`
                            : (t.globalAssistant || 'Global')}
                        </td>
                        <td className="px-4 py-3 text-xs">{assistant.model_policy}</td>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={!!assistant.enabled}
                            onChange={(e) => handleAssistantEnabledChange(assistant, e.target.checked)}
                            aria-label={`${t.enabledLabel || 'Enabled'}: ${assistant.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            className="font-medium text-red-600 dark:text-red-500"
                            onClick={() => setDeleteAssistantTarget(assistant)}
                          >
                            {t.delete}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={`${activeTab === 'admin-settings' ? 'block' : 'hidden'} p-4 rounded-lg bg-gray-50 dark:bg-gray-800`} id="admin-settings" role="tabpanel" aria-labelledby="admin-settings-tab">
            <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.adminSettings}</h2>
            <p className="text-lg text-text-secondary">
              {t.adminSettingsPlaceholder}
            </p>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteUserId}
        title="Delete User"
        message={t.deleteUserConfirm.replace('{username}', deleteUsername)}
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={confirmDeleteUser}
        onCancel={handleCancelDelete}
      />
      <ConfirmDialog
        open={!!deleteAssistantTarget}
        title={t.deleteAssistant || 'Delete Assistant'}
        message={deleteAssistantTarget
          ? (t.deleteAssistantConfirm || 'Delete assistant {name}? This cannot be undone.').replace('{name}', deleteAssistantTarget.name)
          : ''}
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={confirmDeleteAssistant}
        onCancel={() => setDeleteAssistantTarget(null)}
      />
    </div>
  );
}
