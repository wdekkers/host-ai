'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Minus, AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Item = {
  id: string;
  roomId: string;
  name: string;
  quantity: number;
  minQuantity: number;
};

type Room = {
  id: string;
  propertyId: string;
  name: string;
  sortOrder: number;
  items: Item[];
};

type Property = { id: string; name: string };

export function InventoryClient() {
  const { getToken } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [newItemMin, setNewItemMin] = useState(0);
  const [newRoomName, setNewRoomName] = useState('');

  const authHeader = useCallback(async (): Promise<HeadersInit> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const loadProperties = useCallback(async () => {
    const res = await fetch('/api/properties', { headers: await authHeader() });
    if (res.ok) {
      const data = (await res.json()) as { items: Property[] };
      setProperties(data.items ?? []);
      if (!selectedPropertyId && data.items?.length) {
        setSelectedPropertyId(data.items[0]!.id);
      }
    }
  }, [authHeader, selectedPropertyId]);

  const loadRooms = useCallback(async (propertyId: string) => {
    if (!propertyId) return;
    setLoading(true);
    const res = await fetch(`/api/inventory/rooms?propertyId=${propertyId}`, {
      headers: await authHeader(),
    });
    if (res.ok) {
      const data = (await res.json()) as { rooms: Room[] };
      setRooms(data.rooms);
      if (!selectedRoomId || !data.rooms.some((r) => r.id === selectedRoomId)) {
        setSelectedRoomId(data.rooms[0]?.id ?? '');
      }
    }
    setLoading(false);
  }, [authHeader, selectedRoomId]);

  useEffect(() => { void loadProperties(); }, [loadProperties]);
  useEffect(() => { if (selectedPropertyId) void loadRooms(selectedPropertyId); }, [selectedPropertyId, loadRooms]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  const updateQuantity = async (item: Item, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    await fetch(`/api/inventory/rooms/${item.roomId}/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...await authHeader() },
      body: JSON.stringify({ quantity: newQty }),
    });
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        items: r.items.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i)),
      })),
    );
  };

  const addItem = async () => {
    if (!selectedRoomId || !newItemName.trim()) return;
    const res = await fetch(`/api/inventory/rooms/${selectedRoomId}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...await authHeader() },
      body: JSON.stringify({ name: newItemName.trim(), quantity: 0, minQuantity: newItemMin }),
    });
    if (res.ok) {
      setNewItemName('');
      setNewItemMin(0);
      await loadRooms(selectedPropertyId);
    }
  };

  const deleteItem = async (item: Item) => {
    await fetch(`/api/inventory/rooms/${item.roomId}/items/${item.id}`, {
      method: 'DELETE',
      headers: await authHeader(),
    });
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        items: r.items.filter((i) => i.id !== item.id),
      })),
    );
  };

  const addRoom = async () => {
    if (!selectedPropertyId || !newRoomName.trim()) return;
    const res = await fetch('/api/inventory/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...await authHeader() },
      body: JSON.stringify({ propertyId: selectedPropertyId, name: newRoomName.trim() }),
    });
    if (res.ok) {
      setNewRoomName('');
      await loadRooms(selectedPropertyId);
    }
  };

  const lowStockCount = rooms.reduce(
    (acc, r) => acc + r.items.filter((i) => i.quantity <= i.minQuantity && i.minQuantity > 0).length,
    0,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
        <p className="text-sm text-slate-500">Track supplies and equipment per property.</p>
      </div>

      {/* Property selector */}
      <div className="flex items-center gap-3">
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 min-w-[200px]"
          value={selectedPropertyId}
          onChange={(e) => { setSelectedPropertyId(e.target.value); setSelectedRoomId(''); }}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {lowStockCount > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {lowStockCount} low stock
          </Badge>
        )}
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-sm text-slate-400">Loading...</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
          {/* Room tabs */}
          <Card>
            <CardContent className="p-2">
              <div className="space-y-1">
                {rooms.map((r) => {
                  const lowCount = r.items.filter((i) => i.quantity <= i.minQuantity && i.minQuantity > 0).length;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRoomId(r.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                        r.id === selectedRoomId ? 'bg-sky-50 text-sky-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{r.name}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">{r.items.length}</span>
                        {lowCount > 0 && (
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Add room */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                <input
                  className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder="New room..."
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void addRoom(); }}
                />
                <Button size="sm" variant="ghost" onClick={() => void addRoom()} disabled={!newRoomName.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
              <CardTitle className="text-sm font-semibold">
                {selectedRoom?.name ?? 'Select a room'}
              </CardTitle>
              <span className="text-xs text-slate-400">
                {selectedRoom?.items.length ?? 0} items
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {!selectedRoom || selectedRoom.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  No items in this room yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {selectedRoom.items.map((item) => {
                    const isLow = item.minQuantity > 0 && item.quantity <= item.minQuantity;
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${isLow ? 'text-red-600 font-medium' : 'text-slate-900'}`}>
                            {item.name}
                          </span>
                          {isLow && (
                            <span className="ml-2 text-xs text-red-500">Low stock</span>
                          )}
                          {item.minQuantity > 0 && (
                            <span className="ml-1 text-xs text-slate-400">(min: {item.minQuantity})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => void updateQuantity(item, -1)}
                            disabled={item.quantity <= 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className={`text-sm font-bold w-8 text-center ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => void updateQuantity(item, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:text-red-500"
                            onClick={() => void deleteItem(item)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add item */}
              {selectedRoom && (
                <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
                  <input
                    className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="Item name..."
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void addItem(); }}
                  />
                  <input
                    type="number"
                    className="w-16 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="Min"
                    value={newItemMin || ''}
                    onChange={(e) => setNewItemMin(Number(e.target.value))}
                  />
                  <Button size="sm" onClick={() => void addItem()} disabled={!newItemName.trim()}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
