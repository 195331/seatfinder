/**
 * base44Client.js — Compatibility Layer
 *
 * This file keeps the exact same API your 23 pages already use:
 *   base44.entities.Restaurant.filter({ city_id: x })
 *   base44.entities.Favorite.create({ user_id: x, restaurant_id: y })
 *   base44.auth.me()
 *   etc.
 *
 * But under the hood, everything now routes to Supabase.
 * Zero changes needed in any of your pages.
 */

import { supabase } from '@/lib/supabaseClient';

// ─── Entity Factory ───────────────────────────────────────────────────────────
// Creates a Base44-compatible entity object for any Supabase table.
// Table names are automatically lowercased + pluralized to match Supabase conventions.

const toTableName = (entityName) => {
  // Convert PascalCase entity names to snake_case plural table names
  // e.g. "RestaurantTable" -> "restaurant_tables", "City" -> "cities"
  const snake = entityName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');

  // Basic pluralization
  if (snake.endsWith('y')) return snake.slice(0, -1) + 'ies';
  if (snake.endsWith('s')) return snake;
  return snake + 's';
};

const createEntity = (entityName) => {
  const table = toTableName(entityName);

  return {
    // filter({ field: value }) → SELECT * FROM table WHERE field = value
    filter: async (filters = {}) => {
      let query = supabase.from(table).select('*');
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    // list() → SELECT * FROM table
    list: async (options = {}) => {
      let query = supabase.from(table).select('*');
      if (options.limit) query = query.limit(options.limit);
      if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    // get(id) → SELECT * FROM table WHERE id = id LIMIT 1
    get: async (id) => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    // create(obj) → INSERT INTO table VALUES (obj)
    create: async (obj) => {
      const { data, error } = await supabase
        .from(table)
        .insert(obj)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // update(id, obj) → UPDATE table SET obj WHERE id = id
    update: async (id, obj) => {
      const { data, error } = await supabase
        .from(table)
        .update(obj)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // delete(id) → DELETE FROM table WHERE id = id
    delete: async (id) => {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    },

    // bulkCreate([obj1, obj2]) → INSERT multiple rows
    bulkCreate: async (objects) => {
      const { data, error } = await supabase
        .from(table)
        .insert(objects)
        .select();
      if (error) throw error;
      return data || [];
    },
  };
};

// ─── Auth Layer ───────────────────────────────────────────────────────────────
// Mimics base44.auth.* but uses Supabase Auth under the hood.

const auth = {
  // Check if a user is currently logged in
  isAuthenticated: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  },

  // Get the current user profile
  me: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');

    const user = session.user;

    // Try to get extended profile from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Merge auth user with profile data
    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.user_metadata?.full_name || '',
      avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || '',
      ...profile,
    };
  },

  // Update current user's profile
  updateMe: async (updates) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, ...updates })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Redirect to Google OAuth login
  redirectToLogin: (redirectUrl) => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl || window.location.origin,
      },
    });
  },

  // Logout
  logout: async (redirectUrl) => {
    await supabase.auth.signOut();
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      window.location.href = '/';
    }
  },
};

// ─── AI / Functions Layer ─────────────────────────────────────────────────────
// Mimics base44.functions.* — routes to Supabase Edge Functions if needed.

const functions = {
  invoke: async (functionName, payload = {}) => {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload,
    });
    if (error) throw error;
    return data;
  },
};

// ─── Entities Registry ────────────────────────────────────────────────────────
// Add every entity your app uses here. The name must match your Supabase table
// (after automatic snake_case + pluralization conversion).

const entities = new Proxy({}, {
  get(_, entityName) {
    return createEntity(entityName);
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────
export const base44 = {
  auth,
  entities,
  functions,
};
