import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Ban, CheckCircle, ShieldAlert, ArrowLeft } from 'lucide-react';
import api from '../services/api';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isBlocked: boolean;
}

const AdminUsers: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    if (!token || role !== 'ADMIN') {
      navigate('/login');
      return;
    }
    fetchUsers();
  }, [token, role, navigate]);

  useEffect(() => {
    let result = users;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          u.fullName.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== 'ALL') {
      result = result.filter((u) => u.role === roleFilter);
    }

    setFilteredUsers(result);
  }, [searchTerm, roleFilter, users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin/users');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch system users.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (userId: string, isBlocked: boolean) => {
    try {
      setActionLoadingId(userId);
      setError('');
      setSuccessMsg('');
      
      const response = await api.put(`/admin/users/${userId}/block`);
      if (response.data.success) {
        setSuccessMsg(response.data.message || 'Action completed successfully');
        
        // Update local state
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isBlocked: !isBlocked } : u))
        );

        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      console.error('Error blocking user:', err);
      const message = err.response?.data?.message || 'Failed to modify account state.';
      setError(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!token || role !== 'ADMIN') return null;

  return (
    <div className="min-h-full bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Back and Title */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm font-semibold mb-3 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                <Users className="text-blue-600 h-8 w-8" />
                Manage Platform Users
              </h1>
              <p className="text-slate-500 mt-1">Audit accounts, block spammers, or verify user roles.</p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-center font-medium shadow-sm flex items-center justify-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 p-4 rounded-2xl text-center font-medium shadow-sm flex items-center justify-center gap-2">
            <span className="text-xl">✓</span>
            {successMsg}
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm mb-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search user by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="flex gap-2">
            {['ALL', 'PATIENT', 'DOCTOR', 'ADMIN'].map((roleType) => (
              <button
                key={roleType}
                onClick={() => setRoleFilter(roleType)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  roleFilter === roleType
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-600'
                }`}
              >
                {roleType}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <span className="font-bold text-slate-850 block">{user.fullName}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-slate-600 font-medium text-sm">{user.email}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                            user.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-700'
                              : user.role === 'DOCTOR'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {user.isBlocked ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            <Ban className="h-3 w-3" /> Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        {user.role === 'ADMIN' ? (
                          <span className="text-xs text-slate-400 font-bold italic">Protected</span>
                        ) : (
                          <button
                            onClick={() => handleToggleBlock(user.id, user.isBlocked)}
                            disabled={actionLoadingId === user.id}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 border shadow-sm cursor-pointer ${
                              user.isBlocked
                                ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                            } disabled:opacity-50`}
                          >
                            {actionLoadingId === user.id ? (
                              <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : user.isBlocked ? (
                              'Unblock User'
                            ) : (
                              'Block User'
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Showing {filteredUsers.length} total users</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-350">
            <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No accounts matched your filters</h3>
            <p className="text-slate-500 mb-6">Try clearing your search filters or input text.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('ALL');
              }}
              className="text-blue-600 font-bold hover:text-blue-700 text-sm cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
