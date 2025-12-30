import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from "framer-motion";

const QUICK_QUESTIONS = [
  "What's on the menu?",
  "Do you take walk-ins?",
  "Check my reservation status",
  "What are your hours?",
  "Do you have dietary options?",
  "How do I cancel my reservation?"
];

export default function CustomerSupportBot({ restaurant, currentUser, reservation }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm the AI assistant for ${restaurant?.name || 'this restaurant'}. I can help you with:\n\n• Menu questions\n• Reservation inquiries\n• Dietary accommodations\n• Pre-order status\n• General information\n\nHow can I assist you today?`
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (userMessage) => {
      // Build context for AI
      const context = {
        restaurant: restaurant,
        user: currentUser,
        reservation: reservation,
        hasPreOrder: !!reservation?.preorder
      };

      const prompt = `You are a helpful customer support assistant for ${restaurant.name}, a ${restaurant.cuisine} restaurant.

Restaurant Info:
- Cuisine: ${restaurant.cuisine}
- Location: ${restaurant.address}, ${restaurant.neighborhood}
- Price Level: ${'$'.repeat(restaurant.price_level || 2)}
- Available Seats: ${restaurant.available_seats} / ${restaurant.total_seats}
- Phone: ${restaurant.phone}
- Website: ${restaurant.website || 'Not provided'}
- Opening Hours: ${JSON.stringify(restaurant.opening_hours || {})}

${context.user ? `User Info:
- Name: ${context.user.full_name}
- Email: ${context.user.email}` : 'User: Guest (not logged in)'}

${context.reservation ? `Current Reservation:
- Date: ${context.reservation.reservation_date}
- Time: ${context.reservation.reservation_time}
- Party Size: ${context.reservation.party_size}
- Status: ${context.reservation.status}
${context.hasPreOrder ? '- Has Pre-Order: Yes' : ''}` : 'No active reservation'}

User Question: ${userMessage}

Provide a helpful, friendly, and concise response. If the question is about reservations and the user needs to make changes, guide them to contact the restaurant directly or use the app features. If asked about menu items, suggest they check the Menu tab. Keep responses under 150 words.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt
      });

      return response;
    },
    onSuccess: (response) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response
      }]);
    }
  });

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = {
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    chatMutation.mutate(input);
  };

  const handleQuickQuestion = (question) => {
    setMessages(prev => [...prev, {
      role: 'user',
      content: question
    }]);
    chatMutation.mutate(question);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow z-50"
          >
            <MessageCircle className="w-6 h-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-slate-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-pink-600 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">AI Assistant</h3>
                  <p className="text-xs text-white/80">Always here to help</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === 'user'
                        ? "bg-purple-600 text-white"
                        : "bg-white border border-slate-200 text-slate-800"
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown className="prose prose-sm max-w-none [&>p]:m-0">
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}
              
              {chatMutation.isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Questions */}
            {messages.length <= 2 && (
              <div className="px-4 py-2 border-t bg-white">
                <p className="text-xs text-slate-500 mb-2">Quick questions:</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.slice(0, 3).map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(q)}
                      className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t bg-white rounded-b-2xl">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask me anything..."
                  className="flex-1"
                  disabled={chatMutation.isPending}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || chatMutation.isPending}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}