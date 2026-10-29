'use client';

import React, { useState, useTransition } from 'react';
import { updateUserRole, createCategory, toggleCategoryStatus } from './actions';

export default function AdminDashboardClient({
  initialUserCount,
  initialPostCount,
  initialCategories,
  initialUsers,
  roles,
}: any) {
  const [activeTab, setActiveTab] = useState<'categories' | 'users'>('categories');
  const [isPending, startTransition] = useTransition();
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', newCatName);
    formData.append('description', newCatDesc);

    startTransition(async () => {
      await createCategory(formData);
      setNewCatName('');
      setNewCatDesc('');
    });
  };

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white border-b border-slate-800 h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold">CAP</div>
          <span className="font-bold text-lg">Admin Governance Desk</span>
        </div>
        <a href="/feed" className="text-xs text-slate-400 hover:text-white">Exit Admin</a>
      </header>

      <main className="max-w-6xl w-full mx-auto px-6 py-8 flex-1 space-y-6">
        {/* Stat Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-400 font-semibold uppercase">Total Users</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{initialUserCount}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-400 font-semibold uppercase">Active Categories</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{initialCategories.filter((c:any)=>c.is_active).length}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-400 font-semibold uppercase">Posts Published</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{initialPostCount}</div>
          </div>
        </div>

        {/* Admin Tabs Panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-6 pt-4 flex gap-6 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('categories')}
              className={`pb-3 border-b-2 transition-colors ${activeTab === 'categories' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Taxonomy Management
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-3 border-b-2 transition-colors ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              User Role Promotion
            </button>
          </div>

          <div className="p-6 space-y-6">
            {activeTab === 'categories' ? (
              <div className="space-y-6">
                {/* Add Category Form */}
                <form onSubmit={handleCategorySubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Add New Category</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Category Name (e.g., School of Business)"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      required
                      className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Brief description..."
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                      className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all">
                    Create Category
                  </button>
                </form>

                {/* Categories Table */}
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase bg-slate-50">
                      <th className="py-3 px-4">Category Name</th>
                      <th className="py-3 px-4">Slug</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {initialCategories.map((cat: any) => (
                      <tr key={cat.id}>
                        <td className="py-3 px-4 font-semibold text-slate-800">{cat.name}</td>
                        <td className="py-3 px-4 text-slate-500 text-xs font-mono">{cat.slug}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cat.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {cat.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => startTransition(() => toggleCategoryStatus(cat.id, cat.is_active))}
                            className="text-xs text-slate-500 hover:text-blue-600 font-semibold"
                          >
                            {cat.is_active ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900">Institutional User Directory & Roles</h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase bg-slate-50">
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Current Role</th>
                      <th className="py-3 px-4 text-right">Change Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {initialUsers.map((u: any) => (
                      <tr key={u.id}>
                        <td className="py-3 px-4 font-semibold text-slate-800">{u.full_name}</td>
                        <td className="py-3 px-4 text-slate-500 text-xs">{u.email}</td>
                        <td className="py-3 px-4 font-medium text-blue-600">{u.roles?.role_name}</td>
                        <td className="py-3 px-4 text-right">
                          <select
                            defaultValue={u.roles?.id}
                            onChange={(e) => startTransition(() => updateUserRole(u.id, e.target.value))}
                            className="border border-slate-300 rounded-lg p-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            {roles.map((r: any) => (
                              <option key={r.id} value={r.id}>
                                {r.role_name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}