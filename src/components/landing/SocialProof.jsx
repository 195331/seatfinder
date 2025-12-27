import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    quote: "Found a table in 2 minutes. Life-changing.",
    author: "Sarah M.",
    role: "Foodie",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    rating: 5
  },
  {
    quote: "The floor plan builder is insanely easy.",
    author: "Mike R.",
    role: "Restaurant Owner",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
    rating: 5
  },
  {
    quote: "We reduced walk-in chaos instantly.",
    author: "Lisa K.",
    role: "Manager",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa",
    rating: 5
  }
];

export default function SocialProof() {
  return (
    <div className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Loved by diners and owners
          </h2>
          <p className="text-xl text-slate-600">
            Don't just take our word for it
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
            >
              {/* Quote Icon */}
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <Quote className="w-5 h-5 text-emerald-600" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-lg text-slate-700 mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.author}
                  className="w-12 h-12 rounded-full bg-slate-200"
                />
                <div>
                  <p className="font-semibold text-slate-900">{testimonial.author}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}