import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Beaker, Play, CheckCircle, TrendingUp } from 'lucide-react';
import { toast } from "sonner";

const TEST_SUGGESTIONS = [
  {
    id: 'happy_hour_time',
    title: 'Optimize Happy Hour Timing',
    description: 'Test 4-6pm vs 5-7pm happy hour to see which drives more traffic',
    variants: ['4-6pm', '5-7pm'],
    metrics: ['Reservations', 'Revenue', 'Customer count'],
    duration: '2 weeks',
    impact: 'Medium'
  },
  {
    id: 'discount_threshold',
    title: 'Promotional Discount Level',
    description: 'Test 15% vs 20% off to find optimal conversion without hurting margins',
    variants: ['15% off', '20% off'],
    metrics: ['Redemption rate', 'Revenue per customer', 'Repeat visits'],
    duration: '3 weeks',
    impact: 'High'
  },
  {
    id: 'instant_confirm_rules',
    title: 'Instant Confirmation Windows',
    description: 'Test different time windows for auto-approving reservations',
    variants: ['Weekday off-peak only', 'All off-peak hours'],
    metrics: ['Approval rate', 'No-show rate', 'Customer satisfaction'],
    duration: '2 weeks',
    impact: 'High'
  },
  {
    id: 'waitlist_sms_timing',
    title: 'Waitlist Notification Timing',
    description: 'Test when to notify customers (5 min vs 10 min before table ready)',
    variants: ['5 minutes early', '10 minutes early'],
    metrics: ['Show-up rate', 'Average wait time', 'Customer feedback'],
    duration: '2 weeks',
    impact: 'Medium'
  },
  {
    id: 'seating_area_pricing',
    title: 'Premium Seating Surcharge',
    description: 'Test adding a small premium for outdoor/window tables',
    variants: ['No premium', '$5 premium'],
    metrics: ['Selection rate', 'Revenue', 'Customer complaints'],
    duration: '3 weeks',
    impact: 'Low'
  },
];

export default function ABTestingSuggestions({ restaurantId }) {
  const [activeTests, setActiveTests] = useState([]);

  const startTest = async (test) => {
    try {
      // Track test start
      await base44.entities.AnalyticsEvent.create({
        restaurant_id: restaurantId,
        event_type: 'ab_test_started',
        metadata: {
          test_id: test.id,
          test_name: test.title,
          started_at: new Date().toISOString()
        }
      });
      
      setActiveTests([...activeTests, test.id]);
      toast.success(`Started A/B test: ${test.title}`);
    } catch (error) {
      toast.error('Failed to start test');
    }
  };

  const stopTest = async (testId) => {
    try {
      await base44.entities.AnalyticsEvent.create({
        restaurant_id: restaurantId,
        event_type: 'ab_test_stopped',
        metadata: {
          test_id: testId,
          stopped_at: new Date().toISOString()
        }
      });
      
      setActiveTests(activeTests.filter(id => id !== testId));
      toast.success('Test stopped - Analyze results in Analytics');
    } catch (error) {
      toast.error('Failed to stop test');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="w-5 h-5 text-indigo-600" />
          A/B Testing Suggestions
        </CardTitle>
        <CardDescription>
          Data-driven experiments to optimize your operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {TEST_SUGGESTIONS.map((test) => {
          const isActive = activeTests.includes(test.id);
          
          return (
            <div
              key={test.id}
              className="p-4 border-2 border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900">{test.title}</h4>
                    <Badge variant="outline" className={
                      test.impact === 'High' ? 'border-green-300 text-green-700' :
                      test.impact === 'Medium' ? 'border-amber-300 text-amber-700' :
                      'border-slate-300 text-slate-700'
                    }>
                      {test.impact} Impact
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">{test.description}</p>
                </div>
                <Button
                  size="sm"
                  variant={isActive ? "destructive" : "default"}
                  onClick={() => isActive ? stopTest(test.id) : startTest(test)}
                  className="ml-4"
                >
                  {isActive ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Stop Test
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1" />
                      Start Test
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {test.variants.map((variant, i) => (
                  <div
                    key={i}
                    className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-center"
                  >
                    <span className="text-xs font-medium text-indigo-900">
                      Variant {String.fromCharCode(65 + i)}
                    </span>
                    <p className="text-sm font-semibold text-indigo-700">{variant}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>📊 {test.metrics.join(', ')}</span>
                <span>•</span>
                <span>⏱️ {test.duration}</span>
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Pro Tip</p>
              <p>Run one test at a time for clear results. Track metrics in your Analytics dashboard.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}