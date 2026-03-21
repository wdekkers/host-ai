'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  MoreVertical,
  Pencil,
  Power,
  Trash2,
  X,
} from 'lucide-react';

interface Appliance {
  id: string;
  name: string;
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  location: string | null;
  purchaseDate: string | null;
  warrantyExpiration: string | null;
  photoUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AppliancesClientProps {
  propertyId: string;
}

const LOCATION_COLORS: Record<string, string> = {
  kitchen: 'bg-amber-100 text-amber-800',
  laundry: 'bg-purple-100 text-purple-800',
  utility: 'bg-blue-100 text-blue-800',
  garage: 'bg-slate-100 text-slate-700',
  bathroom: 'bg-teal-100 text-teal-800',
  bedroom: 'bg-pink-100 text-pink-800',
  outdoor: 'bg-green-100 text-green-800',
};

function getLocationColor(location: string): string {
  const key = location.toLowerCase();
  for (const [keyword, color] of Object.entries(LOCATION_COLORS)) {
    if (key.includes(keyword)) return color;
  }
  return 'bg-gray-100 text-gray-700';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function isWarrantyExpired(dateStr: string | null): boolean | null {
  if (!dateStr) return null;
  return new Date(dateStr) < new Date();
}

export function AppliancesClient({ propertyId }: AppliancesClientProps) {
  const { getToken } = useAuth();
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    modelNumber: '',
    serialNumber: '',
    location: '',
    purchaseDate: '',
    warrantyExpiration: '',
    notes: '',
  });

  const fetchAppliances = useCallback(async () => {
    const token = await getToken();
    const params = new URLSearchParams({ propertyId });
    if (showInactive) params.set('includeInactive', 'true');
    const res = await fetch(`/api/appliances?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setAppliances(data.appliances);
    }
    setLoading(false);
  }, [getToken, propertyId, showInactive]);

  useEffect(() => {
    void fetchAppliances();
  }, [fetchAppliances]);

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      modelNumber: '',
      serialNumber: '',
      location: '',
      purchaseDate: '',
      warrantyExpiration: '',
      notes: '',
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getToken();

    const body: Record<string, string> = { ...formData };
    if (!editingId) body.propertyId = propertyId;

    // Remove empty strings
    for (const [key, val] of Object.entries(body)) {
      if (val === '') delete body[key];
    }

    const url = editingId ? `/api/appliances/${editingId}` : '/api/appliances';
    const method = editingId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      resetForm();
      void fetchAppliances();
    }
  };

  const handleEdit = (appliance: Appliance) => {
    setFormData({
      name: appliance.name,
      brand: appliance.brand ?? '',
      modelNumber: appliance.modelNumber ?? '',
      serialNumber: appliance.serialNumber ?? '',
      location: appliance.location ?? '',
      purchaseDate: appliance.purchaseDate
        ? (new Date(appliance.purchaseDate).toISOString().split('T')[0] ?? '')
        : '',
      warrantyExpiration: appliance.warrantyExpiration
        ? (new Date(appliance.warrantyExpiration).toISOString().split('T')[0] ?? '')
        : '',
      notes: appliance.notes ?? '',
    });
    setEditingId(appliance.id);
    setShowForm(true);
    setMenuOpenId(null);
  };

  const handleToggleActive = async (appliance: Appliance) => {
    const token = await getToken();
    await fetch(`/api/appliances/${appliance.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive: !appliance.isActive }),
    });
    setMenuOpenId(null);
    void fetchAppliances();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this appliance permanently? This cannot be undone.')) return;
    const token = await getToken();
    await fetch(`/api/appliances/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMenuOpenId(null);
    void fetchAppliances();
  };

  const activeCount = appliances.filter((a) => a.isActive).length;
  const displayedAppliances = showInactive
    ? appliances
    : appliances.filter((a) => a.isActive);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading appliances...</p>;
  }

  return (
    <div>
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {activeCount} active appliance{activeCount !== 1 ? 's' : ''}
          </span>
          <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-sky-600"
            />
            Show inactive
          </label>
        </div>
        <Button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-sky-600 hover:bg-sky-700 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Appliance
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {editingId ? 'Edit Appliance' : 'Add Appliance'}
              </CardTitle>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Oven / Range"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Samsung"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Model Number
                  </label>
                  <input
                    type="text"
                    value={formData.modelNumber}
                    onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                    placeholder="e.g. NX60A6711SS"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="e.g. 0B7X3AKJ500123"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Kitchen, Laundry"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Warranty Expiration
                  </label>
                  <input
                    type="date"
                    value={formData.warrantyExpiration}
                    onChange={(e) =>
                      setFormData({ ...formData, warrantyExpiration: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 max-w-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Repair history, ordering info, replacement notes..."
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white">
                  {editingId ? 'Save Changes' : 'Add Appliance'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Appliance List */}
      {displayedAppliances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-500">
              No appliances tracked yet. Add your first one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayedAppliances.map((appliance) => {
            const expired = isWarrantyExpired(appliance.warrantyExpiration);
            return (
              <Card
                key={appliance.id}
                className={appliance.isActive ? '' : 'opacity-50'}
              >
                <CardContent className="py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      {/* Name + location badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`font-semibold text-base ${
                            appliance.isActive ? 'text-gray-900' : 'line-through text-gray-500'
                          }`}
                        >
                          {appliance.name}
                        </span>
                        {appliance.location && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${getLocationColor(appliance.location)}`}
                          >
                            {appliance.location}
                          </Badge>
                        )}
                        {!appliance.isActive && (
                          <Badge variant="secondary" className="bg-red-50 text-red-700 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {/* Field grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                        {appliance.brand && (
                          <div>
                            <span className="text-gray-500">Brand</span>
                            <p className="font-medium text-gray-900">{appliance.brand}</p>
                          </div>
                        )}
                        {appliance.modelNumber && (
                          <div>
                            <span className="text-gray-500">Model #</span>
                            <p className="font-mono font-semibold text-gray-900">
                              {appliance.modelNumber}
                            </p>
                          </div>
                        )}
                        {appliance.serialNumber && (
                          <div>
                            <span className="text-gray-500">Serial #</span>
                            <p className="font-mono text-gray-900">{appliance.serialNumber}</p>
                          </div>
                        )}
                        {appliance.purchaseDate && (
                          <div>
                            <span className="text-gray-500">Purchased</span>
                            <p className="text-gray-900">{formatDate(appliance.purchaseDate)}</p>
                          </div>
                        )}
                        {appliance.warrantyExpiration && (
                          <div>
                            <span className="text-gray-500">Warranty expires</span>
                            <p
                              className={`font-medium ${
                                expired ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {formatDate(appliance.warrantyExpiration)}
                              {expired ? ' (expired)' : ''}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {appliance.notes && (
                        <div className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2 border-l-2 border-sky-600">
                          {appliance.notes}
                        </div>
                      )}
                    </div>

                    {/* Menu */}
                    <div className="relative ml-4">
                      <button
                        onClick={() =>
                          setMenuOpenId(menuOpenId === appliance.id ? null : appliance.id)
                        }
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      {menuOpenId === appliance.id && (
                        <div className="absolute right-0 top-8 z-10 w-44 rounded-md bg-white shadow-lg border border-gray-200 py-1">
                          <button
                            onClick={() => handleEdit(appliance)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(appliance)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Power className="h-3.5 w-3.5" />
                            {appliance.isActive ? 'Mark Inactive' : 'Mark Active'}
                          </button>
                          <button
                            onClick={() => handleDelete(appliance.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
