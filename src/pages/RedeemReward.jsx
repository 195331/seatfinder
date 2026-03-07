import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle, XCircle, Loader2, Gift, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createPageUrl } from '@/utils';

export default function RedeemReward() {
  const [status, setStatus] = useState('loading'); // loading | confirm | success | error | expired
  const [redemptionData, setRedemptionData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // Load token info on mount
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No redemption token provided.');
      return;
    }

    const loadToken = async () => {
      const records = await base44.entities.RewardRedemption.filter({ token });
      if (!records || records.length === 0) {
        setStatus('error');
        setErrorMsg('Invalid or unknown redemption link.');
        return;
      }

      const rec = records[0];

      if (rec.status === 'redeemed') {
        setStatus('error');
        setErrorMsg('This reward has already been redeemed.');
        return;
      }

      if (new Date(rec.expires_at) < new Date()) {
        setStatus('expired');
        setErrorMsg('This redemption link has expired (valid for 15 minutes).');
        return;
      }

      setRedemptionData(rec);
      setStatus('confirm');
    };

    loadToken();
  }, [token]);

  const handleConfirmRedeem = async () => {
    setIsRedeeming(true);
    const response = await base44.functions.invoke('redeemRewardToken', { token });
    const data = response.data;

    if (data.success) {
      setRedemptionData(prev => ({ ...prev, ...data }));
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMsg(data.error || 'Redemption failed.');
    }
    setIsRedeeming(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-2xl border-0">
        <CardContent className="p-8 text-center">

          {status === 'loading' && (
            <div className="py-8">
              <Loader2 className="w-12 h-12 animate-spin text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">Verifying redemption token...</p>
            </div>
          )}

          {status === 'confirm' && redemptionData && (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-1">Reward Redemption</h1>
              <p className="text-slate-500 text-sm mb-6">Show this to restaurant staff to confirm</p>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 mb-6 text-left border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Customer</p>
                <p className="font-bold text-slate-900 text-lg mb-4">{redemptionData.user_name}</p>
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Reward</p>
                <p className="font-bold text-slate-900 text-lg">{redemptionData.reward_name}</p>
                {redemptionData.reward_description && (
                  <p className="text-sm text-slate-600 mt-1">{redemptionData.reward_description}</p>
                )}
                <div className="mt-4 pt-4 border-t border-amber-200 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Points to deduct</span>
                  <span className="font-bold text-amber-700 text-lg">{redemptionData.points_cost} pts</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-4">
                ⚠️ Staff: tap "Confirm & Redeem" to apply this reward and deduct points
              </p>

              <Button
                onClick={handleConfirmRedeem}
                disabled={isRedeeming}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold h-12 rounded-xl"
              >
                {isRedeeming
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                  : '✓ Confirm & Redeem'
                }
              </Button>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold text-emerald-700 mb-1">Reward Applied!</h1>
              <p className="text-slate-500 text-sm mb-6">The reward has been successfully redeemed</p>

              <div className="bg-emerald-50 rounded-2xl p-5 mb-6 text-left border border-emerald-200">
                <p className="font-bold text-slate-900 text-lg mb-1">{redemptionData.reward_name}</p>
                <p className="text-sm text-slate-600 mb-4">Redeemed for <strong>{redemptionData.user_name}</strong></p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Points deducted</span>
                  <span className="font-bold text-red-600">-{redemptionData.points_cost} pts</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-500">Remaining balance</span>
                  <span className="font-bold text-emerald-700">{redemptionData.remaining_points} pts</span>
                </div>
              </div>

              <p className="text-xs text-slate-400">You may close this page</p>
            </>
          )}

          {(status === 'error' || status === 'expired') && (
            <>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${status === 'expired' ? 'bg-amber-100' : 'bg-red-100'}`}>
                {status === 'expired'
                  ? <AlertTriangle className="w-9 h-9 text-amber-600" />
                  : <XCircle className="w-9 h-9 text-red-600" />
                }
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                {status === 'expired' ? 'Link Expired' : 'Redemption Failed'}
              </h1>
              <p className="text-slate-500 text-sm mb-6">{errorMsg}</p>
              {status === 'expired' && (
                <p className="text-xs text-slate-400 mb-4">Please ask the customer to generate a new redemption link</p>
              )}
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}