import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, User } from 'lucide-react';
import AICustomerPersona from '@/components/ai/AICustomerPersona';

export default function CustomerProfileManager({ restaurantId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const { data: reservations = [] } = useQuery({
    queryKey: ['allReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 500),
    enabled: !!restaurantId,
  });

  // Extract unique customers
  const customers = React.useMemo(() => {
    const customerMap = {};
    reservations.forEach(r => {
      if (r.user_id && !customerMap[r.user_id]) {
        customerMap[r.user_id] = {
          id: r.user_id,
          name: r.user_name,
          email: r.user_email,
          visits: 0
        };
      }
      if (r.user_id) {
        customerMap[r.user_id].visits++;
      }
    });
    return Object.values(customerMap).sort((a, b) => b.visits - a.visits);
  }, [reservations]);

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Customer Profiles
        </CardTitle>
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customers..."
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredCustomers.length > 0 ? (
          <div className="space-y-2">
            {filteredCustomers.map(customer => (
              <Dialog key={customer.id}>
                <DialogTrigger asChild>
                  <button
                    onClick={() => setSelectedCustomer(customer)}
                    className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{customer.name}</p>
                      <p className="text-sm text-slate-500">{customer.email}</p>
                    </div>
                    <Badge>{customer.visits} visits</Badge>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{customer.name}</DialogTitle>
                  </DialogHeader>
                  <AICustomerPersona
                    customerId={customer.id}
                    restaurantId={restaurantId}
                  />
                </DialogContent>
              </Dialog>
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">
            {searchTerm ? 'No customers found' : 'No customer data yet'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}