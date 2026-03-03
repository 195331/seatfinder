import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { 
  Plus, Trash2, GripVertical, Pencil, Check, X, Loader2,
  ChevronDown, ChevronRight, Leaf, Star
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AIMenuHelper from '@/components/ai/AIMenuHelper';
import AIMenuSuggestions from '@/components/ai/AIMenuSuggestions';
import DietaryTagSelector from '@/components/owner/DietaryTagSelector';

const DEFAULT_CATEGORIES = ['Appetizers', 'Mains', 'Desserts', 'Drinks'];

export default function MenuBuilder({ restaurantId }) {
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState(new Set(DEFAULT_CATEGORIES));
  const [editingItem, setEditingItem] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Appetizers',
    is_popular: false,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    calories: '',
    is_available: true,
    dietary_tags: []
  });

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menuItems', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const createItemMutation = useMutation({
    mutationFn: (item) => base44.entities.MenuItem.create({
      ...item,
      restaurant_id: restaurantId,
      price: parseFloat(item.price) || 0,
      calories: item.calories ? parseInt(item.calories) : null,
      sort_order: (menuItems || []).filter(i => i?.category === item.category).length
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['menuItems']);
      setShowAddDialog(false);
      resetNewItem();
      toast.success('Menu item added!');
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MenuItem.update(id, {
      ...data,
      price: parseFloat(data.price) || 0,
      calories: data.calories ? parseInt(data.calories) : null
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['menuItems']);
      setEditingItem(null);
      toast.success('Item updated!');
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => base44.entities.MenuItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['menuItems']);
      toast.success('Item deleted');
    }
  });

  const categories = [...new Set([...DEFAULT_CATEGORIES, ...(menuItems || []).map(i => i?.category)])].filter(Boolean);

  const resetNewItem = () => {
    setNewItem({
      name: '',
      description: '',
      price: '',
      category: 'Appetizers',
      is_popular: false,
      is_vegetarian: false,
      is_vegan: false,
      is_gluten_free: false,
      calories: '',
      is_available: true,
      dietary_tags: []
    });
    setNewCategory('');
  };

  const toggleCategory = (cat) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(cat)) {
      newSet.delete(cat);
    } else {
      newSet.add(cat);
    }
    setExpandedCategories(newSet);
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    const sourceCategory = source.droppableId;
    const destCategory = destination.droppableId;
    
    const item = menuItems.find(i => i.id === draggableId);
    if (!item) return;

    // Update category if moved to different section
    if (sourceCategory !== destCategory) {
      await updateItemMutation.mutateAsync({ 
        id: item.id, 
        data: { ...item, category: destCategory, sort_order: destination.index }
      });
    } else {
      // Reorder within same category
      const categoryItems = menuItems
        .filter(i => i.category === sourceCategory)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      
      const [removed] = categoryItems.splice(source.index, 1);
      categoryItems.splice(destination.index, 0, removed);
      
      // Update sort orders
      for (let i = 0; i < categoryItems.length; i++) {
        if (categoryItems[i].sort_order !== i) {
          await base44.entities.MenuItem.update(categoryItems[i].id, { sort_order: i });
        }
      }
      queryClient.invalidateQueries(['menuItems']);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AIMenuSuggestions
        restaurantId={restaurantId}
        cuisine="Modern American"
        onAddItem={(item) => createItemMutation.mutate(item)}
      />

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Menu Builder</CardTitle>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2">
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Menu Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <Label>Category</Label>
                  <div className="flex gap-2 mt-1.5">
                    <select
                      value={newCategory || newItem.category}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setNewCategory(' ');
                        } else {
                          setNewItem({ ...newItem, category: e.target.value });
                          setNewCategory('');
                        }
                      }}
                      className="flex-1 px-3 py-2 border rounded-lg"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__new__">+ New Category</option>
                    </select>
                  </div>
                  {newCategory && (
                    <Input
                      value={newCategory}
                      onChange={(e) => {
                        setNewCategory(e.target.value);
                        setNewItem({ ...newItem, category: e.target.value });
                      }}
                      placeholder="Enter category name"
                      className="mt-2"
                    />
                  )}
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Dish name"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Describe the dish..."
                    className="mt-1.5"
                    rows={2}
                  />
                </div>
                
                {/* AI Helper */}
                <AIMenuHelper
                  dishName={newItem.name}
                  currentDescription={newItem.description}
                  price={newItem.price}
                  dietary={{
                    is_vegetarian: newItem.is_vegetarian,
                    is_vegan: newItem.is_vegan,
                    is_gluten_free: newItem.is_gluten_free
                  }}
                  onDescriptionGenerated={(desc) => setNewItem({ ...newItem, description: desc })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Price ($) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      placeholder="0.00"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Calories</Label>
                    <Input
                      type="number"
                      value={newItem.calories}
                      onChange={(e) => setNewItem({ ...newItem, calories: e.target.value })}
                      placeholder="Optional"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      Popular Item
                    </Label>
                    <Switch
                      checked={newItem.is_popular}
                      onCheckedChange={(checked) => setNewItem({ ...newItem, is_popular: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Leaf className="w-4 h-4 text-green-500" />
                      Vegetarian
                    </Label>
                    <Switch
                      checked={newItem.is_vegetarian}
                      onCheckedChange={(checked) => setNewItem({ ...newItem, is_vegetarian: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Vegan</Label>
                    <Switch
                      checked={newItem.is_vegan}
                      onCheckedChange={(checked) => setNewItem({ ...newItem, is_vegan: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Gluten-Free</Label>
                    <Switch
                      checked={newItem.is_gluten_free}
                      onCheckedChange={(checked) => setNewItem({ ...newItem, is_gluten_free: checked })}
                    />
                  </div>
                </div>
                <DietaryTagSelector
                  selectedTags={newItem.dietary_tags || []}
                  onChange={(tags) => setNewItem({ ...newItem, dietary_tags: tags })}
                  dishName={newItem.name}
                  description={newItem.description}
                />
                <Button
                  onClick={() => createItemMutation.mutate(newItem)}
                  disabled={!newItem.name || !newItem.price || createItemMutation.isPending}
                  className="w-full"
                >
                  {createItemMutation.isPending ? 'Adding...' : 'Add Item'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {menuItems.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="mb-2">No menu items yet</p>
            <p className="text-sm">Click "Add Item" to create your menu</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              {(categories || []).map((category) => {
                const categoryItems = (menuItems || [])
                  .filter(i => i?.category === category)
                  .sort((a, b) => (a?.sort_order || 0) - (b?.sort_order || 0));
                
                if (categoryItems.length === 0) return null;
                
                const isExpanded = expandedCategories.has(category);
                
                return (
                  <div key={category} className="border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <span className="font-semibold text-slate-900">{category}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{categoryItems.length}</Badge>
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <Droppable droppableId={category}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="p-2 space-y-2"
                          >
                            {(categoryItems || []).map((item, index) => (
                              <Draggable key={item.id} draggableId={item.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={cn(
                                      "flex items-center gap-3 p-3 bg-white border rounded-lg",
                                      snapshot.isDragging && "shadow-lg"
                                    )}
                                  >
                                    <div {...provided.dragHandleProps} className="cursor-grab">
                                      <GripVertical className="w-5 h-5 text-slate-300" />
                                    </div>
                                    
                                    {editingItem?.id === item.id ? (
                                      <div className="flex-1 space-y-2">
                                        <Input
                                          value={editingItem.name}
                                          onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                          placeholder="Name"
                                        />
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={editingItem.price}
                                          onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                                          placeholder="Price"
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => updateItemMutation.mutate({ id: item.id, data: editingItem })}
                                            disabled={updateItemMutation.isPending}
                                          >
                                            <Check className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditingItem(null)}
                                          >
                                            <X className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">{item.name}</span>
                                            {item.is_popular && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                                            {item.is_vegetarian && <Leaf className="w-4 h-4 text-green-500" />}
                                            {!item.is_available && (
                                              <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                                            )}
                                          </div>
                                          {item.description && (
                                            <p className="text-sm text-slate-500 truncate">{item.description}</p>
                                          )}
                                        </div>
                                        <span className="font-semibold text-slate-900">${item.price?.toFixed(2)}</span>
                                        <div className="flex gap-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditingItem({ ...item })}
                                          >
                                            <Pencil className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-500 hover:text-red-600"
                                            onClick={() => deleteItemMutation.mutate(item.id)}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )}
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </CardContent>
    </Card>
    </div>
  );
}