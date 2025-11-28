import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Save, Upload, ZoomIn, ZoomOut, Maximize2, Trash2, 
  RotateCw, Plus, GripVertical, Circle, Square, RectangleHorizontal,
  Armchair, ChevronDown, ChevronUp, Accessibility, X
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import FloorPlanCanvas from '@/components/floorplan/FloorPlanCanvas';
import TablePalette from '@/components/floorplan/TablePalette';
import AreaManager from '@/components/floorplan/AreaManagerPanel';
import TableDetailPanel from '@/components/floorplan/TableDetailPanel';
import LiveStats from '@/components/floorplan/LiveStats';

const CUISINES = [
  'Italian', 'Japanese', 'Mexican', 'American', 'Chinese', 'Indian', 
  'French', 'Thai', 'Mediterranean', 'Korean', 'Vietnamese', 'Greek'
];

const AREA_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
];

export default function FloorPlanDesigner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('id');

  const [currentUser, setCurrentUser] = useState(null);
  const [infoOpen, setInfoOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [showCustomTableDialog, setShowCustomTableDialog] = useState(false);
  const [customTableData, setCustomTableData] = useState({ seats: 4, shape: 'round' });
  const [lastSaved, setLastSaved] = useState(null);
  const [isDraggingNewTable, setIsDraggingNewTable] = useState(null);

  // Restaurant form state
  const [restaurantForm, setRestaurantForm] = useState({
    name: '',
    neighborhood: '',
    cuisine: '',
    price_level: 2
  });

  // Areas state
  const [areas, setAreas] = useState([]);
  
  // Tables state
  const [tables, setTables] = useState([]);

  // Auth check
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          navigate(createPageUrl('Home'));
          return;
        }
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  // Fetch restaurant if editing
  const { data: restaurant, isLoading: loadingRestaurant } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0]),
    enabled: !!restaurantId,
  });

  // Fetch existing areas
  const { data: existingAreas = [] } = useQuery({
    queryKey: ['areas', restaurantId],
    queryFn: () => base44.entities.RestaurantArea.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  // Fetch existing tables
  const { data: existingTables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  // Initialize form with existing data
  useEffect(() => {
    if (restaurant) {
      setRestaurantForm({
        name: restaurant.name || '',
        neighborhood: restaurant.neighborhood || '',
        cuisine: restaurant.cuisine || '',
        price_level: restaurant.price_level || 2
      });
    }
  }, [restaurant]);

  useEffect(() => {
    if (existingAreas.length > 0) {
      setAreas(existingAreas.map(a => ({
        id: a.id,
        name: a.name,
        color: AREA_COLORS.find(c => c.name.toLowerCase() === a.name?.toLowerCase())?.value || AREA_COLORS[0].value,
        bounds: { x: 50, y: 50, width: 300, height: 200 }
      })));
    }
  }, [existingAreas]);

  useEffect(() => {
    if (existingTables.length > 0) {
      setTables(existingTables.map(t => ({
        id: t.id,
        label: t.label,
        seats: t.capacity,
        shape: t.shape || 'round',
        x: t.position_x || 100,
        y: t.position_y || 100,
        rotation: 0,
        areaId: t.area_id,
        isAccessible: false
      })));
    }
  }, [existingTables]);

  // Add default area if none exist
  useEffect(() => {
    if (areas.length === 0 && !restaurantId) {
      setAreas([{ 
        id: 'area-1', 
        name: 'Main Dining', 
        color: AREA_COLORS[0].value,
        bounds: { x: 50, y: 50, width: 400, height: 300 }
      }]);
      setSelectedAreaId('area-1');
    }
  }, [areas.length, restaurantId]);

  // Table operations
  const addTable = useCallback((seats, shape, position) => {
    const tableNumber = tables.length + 1;
    const newTable = {
      id: `table-${Date.now()}`,
      label: `T${tableNumber}`,
      seats,
      shape,
      x: position?.x || 150,
      y: position?.y || 150,
      rotation: 0,
      areaId: selectedAreaId || areas[0]?.id,
      isAccessible: false
    };
    setTables(prev => [...prev, newTable]);
    setSelectedTableId(newTable.id);
  }, [tables.length, selectedAreaId, areas]);

  const updateTable = useCallback((tableId, updates) => {
    setTables(prev => prev.map(t => 
      t.id === tableId ? { ...t, ...updates } : t
    ));
  }, []);

  const deleteTable = useCallback((tableId) => {
    setTables(prev => prev.filter(t => t.id !== tableId));
    if (selectedTableId === tableId) {
      setSelectedTableId(null);
    }
  }, [selectedTableId]);

  const selectedTable = tables.find(t => t.id === selectedTableId);

  // Area operations
  const addArea = useCallback(() => {
    const areaNumber = areas.length + 1;
    const colorIndex = areas.length % AREA_COLORS.length;
    const newArea = {
      id: `area-${Date.now()}`,
      name: `Area ${areaNumber}`,
      color: AREA_COLORS[colorIndex].value,
      bounds: { x: 50 + (areaNumber * 20), y: 50 + (areaNumber * 20), width: 300, height: 200 }
    };
    setAreas(prev => [...prev, newArea]);
    setSelectedAreaId(newArea.id);
  }, [areas.length]);

  const updateArea = useCallback((areaId, updates) => {
    setAreas(prev => prev.map(a => 
      a.id === areaId ? { ...a, ...updates } : a
    ));
  }, []);

  const deleteArea = useCallback((areaId) => {
    setAreas(prev => prev.filter(a => a.id !== areaId));
    // Remove tables in this area
    setTables(prev => prev.filter(t => t.areaId !== areaId));
    if (selectedAreaId === areaId) {
      setSelectedAreaId(null);
    }
  }, [selectedAreaId]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (publish = false) => {
      let restId = restaurantId;

      // Create or update restaurant
      if (restaurantId) {
        await base44.entities.Restaurant.update(restaurantId, {
          ...restaurantForm,
          total_seats: tables.reduce((sum, t) => sum + t.seats, 0),
          available_seats: tables.reduce((sum, t) => sum + t.seats, 0),
          status: publish ? 'approved' : restaurant?.status || 'pending'
        });
      } else {
        const slug = restaurantForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const newRest = await base44.entities.Restaurant.create({
          ...restaurantForm,
          slug,
          owner_id: currentUser?.id,
          total_seats: tables.reduce((sum, t) => sum + t.seats, 0),
          available_seats: tables.reduce((sum, t) => sum + t.seats, 0),
          status: publish ? 'approved' : 'pending'
        });
        restId = newRest.id;
      }

      // Delete existing areas and tables
      if (restaurantId) {
        for (const area of existingAreas) {
          await base44.entities.RestaurantArea.delete(area.id);
        }
        for (const table of existingTables) {
          await base44.entities.Table.delete(table.id);
        }
      }

      // Create new areas
      const areaIdMap = {};
      for (const area of areas) {
        const newArea = await base44.entities.RestaurantArea.create({
          restaurant_id: restId,
          name: area.name,
          max_seats: tables.filter(t => t.areaId === area.id).reduce((sum, t) => sum + t.seats, 0),
          available_seats: tables.filter(t => t.areaId === area.id).reduce((sum, t) => sum + t.seats, 0),
          is_open: true,
          sort_order: areas.indexOf(area)
        });
        areaIdMap[area.id] = newArea.id;
      }

      // Create new tables
      for (const table of tables) {
        await base44.entities.Table.create({
          restaurant_id: restId,
          area_id: areaIdMap[table.areaId] || null,
          label: table.label,
          capacity: table.seats,
          status: 'free',
          position_x: table.x,
          position_y: table.y,
          shape: table.shape
        });
      }

      return { restId, publish };
    },
    onSuccess: ({ publish }) => {
      setLastSaved(new Date());
      queryClient.invalidateQueries(['restaurant']);
      queryClient.invalidateQueries(['areas']);
      queryClient.invalidateQueries(['tables']);
      
      if (publish) {
        toast.success("Your restaurant is live. Diners can now see this layout.");
      } else {
        toast.success("Draft saved successfully");
      }
    },
    onError: (error) => {
      toast.error("Failed to save: " + error.message);
    }
  });

  const handleSaveDraft = () => saveMutation.mutate(false);
  const handlePublish = () => {
    if (!restaurantForm.name) {
      toast.error("Please enter a restaurant name");
      return;
    }
    if (!restaurantForm.cuisine) {
      toast.error("Please select a cuisine type");
      return;
    }
    if (tables.length === 0) {
      toast.error("Please add at least one table");
      return;
    }
    saveMutation.mutate(true);
  };

  const handleCanvasClick = (e, canvasRect) => {
    if (isDraggingNewTable) {
      const x = (e.clientX - canvasRect.left) / zoom;
      const y = (e.clientY - canvasRect.top) / zoom;
      addTable(isDraggingNewTable.seats, isDraggingNewTable.shape, { x, y });
      setIsDraggingNewTable(null);
    } else {
      setSelectedTableId(null);
    }
  };

  const handleAddCustomTable = () => {
    addTable(customTableData.seats, customTableData.shape);
    setShowCustomTableDialog(false);
    setCustomTableData({ seats: 4, shape: 'round' });
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-semibold text-slate-800 hidden sm:block">SeatFinder Owner</span>
          </div>

          <h1 className="text-lg font-semibold text-slate-700 hidden md:block">
            Design your floor plan
          </h1>

          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-slate-500 hidden sm:block">
                Last saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <Button 
              variant="outline" 
              onClick={handleSaveDraft}
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Save Draft</span>
            </Button>
            <Button 
              onClick={handlePublish}
              disabled={saveMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Publish</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-[1800px] mx-auto w-full">
        {/* Left Panel */}
        <div className="w-full lg:w-80 space-y-4 shrink-0">
          {/* Restaurant Info */}
          <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Restaurant Info</CardTitle>
                    {infoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div>
                    <Label className="text-sm text-slate-600">Restaurant Name</Label>
                    <Input
                      value={restaurantForm.name}
                      onChange={(e) => setRestaurantForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Tony's Italian Kitchen"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-slate-600">Location / Neighborhood</Label>
                    <Input
                      value={restaurantForm.neighborhood}
                      onChange={(e) => setRestaurantForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                      placeholder="e.g. Downtown, Exchange Place"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-slate-600">Cuisine</Label>
                    <Select 
                      value={restaurantForm.cuisine} 
                      onValueChange={(v) => setRestaurantForm(prev => ({ ...prev, cuisine: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select cuisine" />
                      </SelectTrigger>
                      <SelectContent>
                        {CUISINES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-slate-600">Price Level</Label>
                    <div className="flex gap-2 mt-1">
                      {[1, 2, 3, 4].map(level => (
                        <Button
                          key={level}
                          variant={restaurantForm.price_level === level ? "default" : "outline"}
                          size="sm"
                          onClick={() => setRestaurantForm(prev => ({ ...prev, price_level: level }))}
                          className={cn(
                            "flex-1",
                            restaurantForm.price_level === level && "bg-emerald-600 hover:bg-emerald-700"
                          )}
                        >
                          {'$'.repeat(level)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Areas */}
          <AreaManager
            areas={areas}
            selectedAreaId={selectedAreaId}
            onSelectArea={setSelectedAreaId}
            onAddArea={addArea}
            onUpdateArea={updateArea}
            onDeleteArea={deleteArea}
            areaColors={AREA_COLORS}
            tables={tables}
          />

          {/* Table Palette */}
          <TablePalette
            onAddTable={(seats, shape) => {
              if (shape === 'custom') {
                setShowCustomTableDialog(true);
              } else {
                setIsDraggingNewTable({ seats, shape });
              }
            }}
            isDragging={!!isDraggingNewTable}
          />
        </div>

        {/* Right Panel - Canvas */}
        <div className="flex-1 flex flex-col min-h-[500px] lg:min-h-0">
          {/* Live Stats */}
          <LiveStats tables={tables} areas={areas} />

          {/* Canvas Controls */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                className="h-8 w-8"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-slate-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                className="h-8 w-8"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setZoom(1)}
                className="h-8 w-8 ml-1"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>

            {selectedTableId && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => deleteTable(selectedTableId)}
                className="gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Delete Table
              </Button>
            )}
          </div>

          {/* Canvas */}
          <div className="flex-1 flex gap-4">
            <div className="flex-1">
              <FloorPlanCanvas
                zoom={zoom}
                areas={areas}
                tables={tables}
                selectedTableId={selectedTableId}
                selectedAreaId={selectedAreaId}
                onSelectTable={setSelectedTableId}
                onUpdateTable={updateTable}
                onCanvasClick={handleCanvasClick}
                isDraggingNewTable={isDraggingNewTable}
              />
            </div>

            {/* Table Detail Panel */}
            {selectedTable && (
              <TableDetailPanel
                table={selectedTable}
                areas={areas}
                onUpdate={(updates) => updateTable(selectedTableId, updates)}
                onDelete={() => deleteTable(selectedTableId)}
                onClose={() => setSelectedTableId(null)}
              />
            )}
          </div>

          {/* Instructions */}
          {isDraggingNewTable && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 text-center">
              Click anywhere on the canvas to place the table, or press Escape to cancel
            </div>
          )}
        </div>
      </div>

      {/* Custom Table Dialog */}
      <Dialog open={showCustomTableDialog} onOpenChange={setShowCustomTableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Number of Seats</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={customTableData.seats}
                onChange={(e) => setCustomTableData(prev => ({ ...prev, seats: parseInt(e.target.value) || 1 }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Shape</Label>
              <Select 
                value={customTableData.shape} 
                onValueChange={(v) => setCustomTableData(prev => ({ ...prev, shape: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round">Round</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="rectangle">Rectangular</SelectItem>
                  <SelectItem value="booth">Booth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCustomTableDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddCustomTable} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                Add Table
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}