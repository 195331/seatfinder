import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, Send, Sparkles, Loader2, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AIConcierge({ restaurants, currentUser, onRestaurantClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build context about restaurants and user
      const restaurantContext = restaurants.map(r => ({
        name: r.name,
        cuisine: r.cuisine,
        price_level: r.price_level,
        neighborhood: r.neighborhood,
        has_outdoor: r.has_outdoor,
        is_kid_friendly: r.is_kid_friendly,
        has_bar_seating: r.has_bar_seating,
        average_rating: r.average_rating,
        available_seats: r.available_seats,
        opening_hours: r.opening_hours
      }));

      const userPreferences = currentUser?.preferences || {};
      const tasteProfile = currentUser?.taste_profile || {};

      const prompt = `You are a restaurant concierge AI. Help the user find the perfect restaurant.

User query: "${userMessage}"

User preferences:
- Favorite cuisines: ${userPreferences.favorite_cuisines?.join(', ') || 'None set'}
- Dietary restrictions: ${userPreferences.dietary_restrictions?.join(', ') || 'None'}
- Taste profile: Outdoor seating: ${tasteProfile.outdoor_seating ? 'Yes' : 'No'}, Kid-friendly: ${tasteProfile.kid_friendly ? 'Yes' : 'No'}, Bar seating: ${tasteProfile.bar_seating ? 'Yes' : 'No'}

Available restaurants: ${JSON.stringify(restaurantContext.slice(0, 20))}

Instructions:
1. Analyze the user's query and match it with appropriate restaurants
2. Consider their preferences and taste profile
3. Provide 2-3 specific restaurant recommendations with reasons why they match
4. Be conversational and helpful
5. If asked about availability, mention current seating status
6. Keep response concise but informative (max 150 words)`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: null
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      toast.error('Failed to get AI response');
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    "What's good for a romantic dinner?",
    "Recommend family-friendly restaurants",
    "Best outdoor dining options?",
    "Where can I get great vegetarian food?"
  ];

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-xl flex items-center justify-center hover:shadow-2xl transition-shadow"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </motion.button>
      )}

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)]"
          >
            <Card className="shadow-2xl border-2 border-purple-200">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-white" />
                  <h3 className="font-semibold text-white">AI Concierge</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <CardContent className="p-4 space-y-4">
                {/* Messages */}
                <div className="h-[400px] overflow-y-auto space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <Sparkles className="w-12 h-12 mx-auto text-purple-300 mb-3" />
                      <p className="text-slate-600 font-medium mb-2">
                        How can I help you today?
                      </p>
                      <p className="text-sm text-slate-500 mb-4">
                        Ask me anything about restaurants!
                      </p>
                      <div className="space-y-2">
                        {quickQuestions.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setInput(q);
                              setTimeout(() => handleSend(), 100);
                            }}
                            className="block w-full text-left px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] p-3 rounded-2xl",
                          msg.role === 'user'
                            ? "bg-purple-600 text-white"
                            : "bg-slate-100 text-slate-900"
                        )}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 p-3 rounded-2xl">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask me anything..."
                    className="flex-1"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}