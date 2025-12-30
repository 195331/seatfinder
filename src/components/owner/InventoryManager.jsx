import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Package, Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from "sonner";

const CATEGORIES = ['protein', 'produce', 'dairy', 'dry_goods', 'beverages', 'other'];

export default function InventoryManager({ restaurantId }) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'other',
    current_quantity: 0,
    unit: 'units',
    reorder_threshold: 10,
    supplier: '',
    cost_per_unit: 0
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', restaurantId],
    queryFn: () => base44.entities.InventoryItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.InventoryItem.create({
      ...data,
      restaurant_id: restaurantId,
      current_quantity: parseFloat(data.current_quantity) || 0,
      reorder_threshold: parseFloat(data.reorder_threshold) || 0,
      cost_per_unit: parseFloat(data.cost_per_unit) || 0
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory']);
      setShowAddDialog(false);
      setNewItem({ name: '', category: 'other', current_quantity: 0, unit: 'units', reorder_threshold: 10, supplier: '', cost_per_unit: 0 });
      toast.success('Inventory item added');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InventoryItem.update(id, {
      ...data,
      current_quantity: parseFloat(data.current_quantity) || 0
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory']);
      setEditingItem(null);
      toast.success('Updated');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InventoryItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory']);
      toast.success('Deleted');
    }
  });

  const lowStockItems = useMemo(() => 
    inventory.filter(item => item.current_quantity <= item.reorder_threshold),
    [inventory]
  );

  return (
    <div className="space-y-6">
      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                  <span className="font-medium text-slate-900">{item.name}</span>
                  <Badge variant="destructive">
                    {item.current_quantity} {item.unit} left
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory List */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Inventory
            </CardTitle>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Inventory Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      placeholder="e.g., Fresh Salmon"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Category</Label>
                      <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat.replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <Input
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        placeholder="lbs, kg, units"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Current Quantity</Label>
                      <Input
                        type="number"
                        value={newItem.current_quantity}
                        onChange={(e) => setNewItem({ ...newItem, current_quantity: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Reorder At</Label>
                      <Input
                        type="number"
                        value={newItem.reorder_threshold}
                        onChange={(e) => setNewItem({ ...newItem, reorder_threshold: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => createMutation.mutate(newItem)}
                    disabled={!newItem.name || createMutation.isPending}
                    className="w-full"
                  >
                    {createMutation.isPending ? 'Adding...' : 'Add Item'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {inventory.length > 0 ? (
            <div className="space-y-2">
              {inventory.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                      {item.current_quantity <= item.reorder_threshold && (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {item.current_quantity} {item.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingItem?.id === item.id ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={editingItem.current_quantity}
                          onChange={(e) => setEditingItem({ ...editingItem, current_quantity: e.target.value })}
                          className="w-24"
                        />
                        <Button
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: item.id, data: editingItem })}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingItem(item)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">
              No inventory items. Click "Add Item" to start tracking.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}