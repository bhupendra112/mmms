import React, { useState, useEffect } from "react";
import { UserCheck, Plus, Edit, Ban, X } from "lucide-react";
import { getSupervisors, createSupervisor, updateSupervisor, disableSupervisor } from "../../services/supervisorService";

export default function SupervisorManagement() {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [createForm, setCreateForm] = useState({ name: "", email: "", password: "" });
    const [editForm, setEditForm] = useState({ name: "", email: "", password: "" });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    const loadList = async () => {
        try {
            setLoading(true);
            setError("");
            const res = await getSupervisors();
            const data = res?.data ?? res;
            setList(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.message || "Failed to load supervisors");
            setList([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadList();
    }, []);

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setSaveError("");
        setSaving(true);
        try {
            await createSupervisor({
                name: createForm.name.trim(),
                email: createForm.email.trim(),
                password: createForm.password,
            });
            setShowCreateModal(false);
            setCreateForm({ name: "", email: "", password: "" });
            loadList();
        } catch (err) {
            setSaveError(err?.message || "Failed to create supervisor");
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (s) => {
        setEditingId(s._id || s.id);
        setEditForm({ name: s.name || "", email: s.email || "", password: "" });
        setShowEditModal(true);
        setSaveError("");
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editingId) return;
        setSaveError("");
        setSaving(true);
        try {
            const body = { name: editForm.name.trim(), email: editForm.email.trim() };
            if (editForm.password && editForm.password.length >= 6) body.password = editForm.password;
            await updateSupervisor(editingId, body);
            setShowEditModal(false);
            setEditingId(null);
            setEditForm({ name: "", email: "", password: "" });
            loadList();
        } catch (err) {
            setSaveError(err?.message || "Failed to update supervisor");
        } finally {
            setSaving(false);
        }
    };

    const handleDisable = async (id) => {
        if (!window.confirm("Disable this supervisor? They will not be able to log in.")) return;
        try {
            await disableSupervisor(id);
            loadList();
        } catch (err) {
            setError(err?.message || "Failed to disable supervisor");
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Supervisor Management</h1>
                <button
                    type="button"
                    onClick={() => { setShowCreateModal(true); setSaveError(""); setCreateForm({ name: "", email: "", password: "" }); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                >
                    <Plus size={18} />
                    Add Supervisor
                </button>
            </div>

            {error && <p className="text-red-600 mb-4">{error}</p>}

            {loading ? (
                <p className="text-gray-500">Loading...</p>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Place</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {list.map((s) => (
                                <tr key={s._id || s.id}>
                                    <td className="px-4 py-3 text-sm text-gray-900">{s.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{s.email}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{s.place || "—"}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 text-xs font-medium rounded ${s.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {s.status === "active" && (
                                            <>
                                                <button type="button" onClick={() => openEdit(s)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Edit">
                                                    <Edit size={16} />
                                                </button>
                                                <button type="button" onClick={() => handleDisable(s._id || s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Disable">
                                                    <Ban size={16} />
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {list.length === 0 && <p className="px-4 py-8 text-center text-gray-500">No supervisors yet. Create one to get started.</p>}
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Create Supervisor</h2>
                            <button type="button" onClick={() => setShowCreateModal(false)} className="p-1 text-gray-500 hover:text-gray-700"><X size={20} /></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Place will be set from your account.</p>
                        {saveError && <p className="text-red-600 text-sm mb-2">{saveError}</p>}
                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                <input type="text" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Full name" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Email" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password * (min 6)</label>
                                <input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} required minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Password" />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Edit Supervisor</h2>
                            <button type="button" onClick={() => { setShowEditModal(false); setEditingId(null); }} className="p-1 text-gray-500 hover:text-gray-700"><X size={20} /></button>
                        </div>
                        {saveError && <p className="text-red-600 text-sm mb-2">{saveError}</p>}
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New password (optional, min 6)</label>
                                <input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Leave blank to keep current" />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button type="button" onClick={() => { setShowEditModal(false); setEditingId(null); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">Update</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
