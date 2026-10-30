import React, { useState, useMemo } from 'react';
import { 
  X, 
  History, 
  Award, 
  DollarSign, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Phone, 
  Mail, 
  Calendar, 
  Search,
  Truck,
  Check,
  CreditCard
} from 'lucide-react';
import { ConfirmationMember, Order, TeamPayout } from '../types';

interface MemberHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: ConfirmationMember | null;
  orders: Order[];
  payouts?: TeamPayout[];
  onOpenEditOrder: (order: Order) => void;
  onPayMember?: (member: ConfirmationMember, due: number) => void;
}

export const MemberHistoryModal: React.FC<MemberHistoryModalProps> = ({
  isOpen,
  onClose,
  member,
  orders,
  payouts = [],
  onOpenEditOrder,
  onPayMember,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'payouts'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter orders for this member
  const memberOrders = useMemo(() => {
    if (!member) return [];
    return orders.filter((o) => o.confirmationMemberId === member.id);
  }, [orders, member]);

  // Filter payouts for this member
  const memberPayouts = useMemo(() => {
    if (!member) return [];
    return payouts.filter((p) => p.memberId === member.id);
  }, [payouts, member]);

  // Aggregate statistics for this member
  const stats = useMemo(() => {
    let totalOrders = memberOrders.length;
    let deliveredOrders = 0;
    let confirmedOrders = 0;
    let cancelledOrders = 0;
    let grantedRewards = 0;
    let pendingRewards = 0;
    let totalUpsellBonus = 0;

    memberOrders.forEach((o) => {
      const reward = o.memberReward || 0;
      const basePr = typeof o.basePrice === 'number' && o.basePrice > 0 ? o.basePrice : o.salePrice;
      const upsellPerUnit = Math.max(0, o.salePrice - basePr);
      const upsellTotal = upsellPerUnit * o.quantity;

      if (o.status === 'delivered' || o.status === 'completed') {
        deliveredOrders++;
      } else if (o.status === 'confirmed' || o.status === 'shipped' || o.status === 'pending_pickup') {
        confirmedOrders++;
      } else if (o.status === 'cancelled') {
        cancelledOrders++;
      }

      if (o.status !== 'cancelled') {
        totalUpsellBonus += upsellTotal;

        if (o.rewardStatus === 'granted') {
          grantedRewards += reward;
        } else if (o.rewardStatus === 'pending') {
          pendingRewards += reward;
        } else {
          if (member?.rewardTrigger === 'confirmed') {
            if (['confirmed', 'delivered', 'completed', 'shipped'].includes(o.status)) {
              grantedRewards += reward;
            } else {
              pendingRewards += reward;
            }
          } else {
            if (['delivered', 'completed'].includes(o.status)) {
              grantedRewards += reward;
            } else {
              pendingRewards += reward;
            }
          }
        }
      }
    });

    const totalPaid = member?.totalPaid || 0;
    const unpaidBalance = Math.max(0, grantedRewards - totalPaid);

    return {
      totalOrders,
      deliveredOrders,
      confirmedOrders,
      cancelledOrders,
      grantedRewards: Number(grantedRewards.toFixed(2)),
      pendingRewards: Number(pendingRewards.toFixed(2)),
      totalUpsellBonus: Number(totalUpsellBonus.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      unpaidBalance: Number(unpaidBalance.toFixed(2)),
    };
  }, [memberOrders, member]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return memberOrders.filter((ord) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'delivered' && (ord.status === 'delivered' || ord.status === 'completed')) ||
        (statusFilter === 'confirmed' && (ord.status === 'confirmed' || ord.status === 'pending_pickup' || ord.status === 'shipped')) ||
        (statusFilter === 'new' && ord.status === 'new') ||
        (statusFilter === 'cancelled' && ord.status === 'cancelled');

      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        ord.buyerName.toLowerCase().includes(q) ||
        ord.itemTitle.toLowerCase().includes(q) ||
        (ord.customerPhone && ord.customerPhone.toLowerCase().includes(q)) ||
        ord.id.toLowerCase().includes(q)
      );
    });
  }, [memberOrders, statusFilter, searchQuery]);

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              {member.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 text-base sm:text-lg">{member.name}</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    member.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {member.status === 'active' ? 'Active' : 'Inactive'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {member.rewardTrigger === 'confirmed' ? 'On Confirmed' : 'On Delivered'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5">
                {member.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {member.phone}
                  </span>
                )}
                {member.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {member.email}
                  </span>
                )}
                <span className="flex items-center gap-1 font-semibold text-slate-700">
                  <Award className="w-3 h-3 text-amber-500" />
                  Base: ${member.baseReward.toFixed(2)} ({member.rewardCalculationMode === 'per_item' ? 'Per Item' : 'Per Order'})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onPayMember && (
              <button
                onClick={() => onPayMember(member, stats.unpaidBalance)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                <span>Pay Member</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Member KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Orders
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black text-slate-900">
                  {stats.totalOrders}
                </span>
                <span className="text-xs text-emerald-600 font-bold">
                  {stats.deliveredOrders} delivered
                </span>
              </div>
            </div>

            <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Total Earned
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl sm:text-2xl font-black text-emerald-700">
                  ${stats.grantedRewards.toFixed(2)}
                </span>
              </div>
              <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                Granted rewards
              </span>
            </div>

            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                Total Paid
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl sm:text-2xl font-black text-blue-700">
                  ${stats.totalPaid.toFixed(2)}
                </span>
              </div>
              <span className="text-[10px] text-blue-600 block mt-0.5 font-medium">
                Recorded payouts
              </span>
            </div>

            <div className={`p-3.5 rounded-xl border ${stats.unpaidBalance > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-[11px] font-bold uppercase tracking-wider block ${stats.unpaidBalance > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
                Balance Due
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-xl sm:text-2xl font-black ${stats.unpaidBalance > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                  ${stats.unpaidBalance.toFixed(2)}
                </span>
              </div>
              <span className={`text-[10px] block mt-0.5 font-medium ${stats.unpaidBalance > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {stats.unpaidBalance > 0 ? 'Unsettled amount' : 'Fully settled'}
              </span>
            </div>
          </div>

          {/* Sub Navigation Tabs: Orders vs Payouts */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Orders ({memberOrders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'payouts'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payouts ({memberPayouts.length})</span>
            </button>
          </div>

          {activeTab === 'orders' ? (
            <>
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by buyer or item..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: `All (${memberOrders.length})` },
                    { id: 'delivered', label: `Delivered (${stats.deliveredOrders})` },
                    { id: 'confirmed', label: `Confirmed (${stats.confirmedOrders})` },
                    { id: 'new', label: 'New' },
                    { id: 'cancelled', label: `Cancelled (${stats.cancelledOrders})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        statusFilter === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orders History Table */}
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                  <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No orders found</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Date & Order</th>
                          <th className="py-3 px-4">Product & Buyer</th>
                          <th className="py-3 px-4 text-right">Base vs Sale</th>
                          <th className="py-3 px-4 text-right">Reward</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-center">Reward Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOrders.map((ord) => {
                          const basePr = typeof ord.basePrice === 'number' && ord.basePrice > 0 ? ord.basePrice : ord.salePrice;
                          const hasUpsell = ord.salePrice > basePr;
                          const upsellDiff = Math.max(0, ord.salePrice - basePr) * ord.quantity;
                          const baseRewardPart = (ord.memberReward || 0) - upsellDiff;

                          const isGranted =
                            ord.rewardStatus === 'granted' ||
                            (member.rewardTrigger === 'confirmed'
                              ? ['confirmed', 'delivered', 'completed', 'shipped'].includes(ord.status)
                              : ['delivered', 'completed'].includes(ord.status));

                          const isCancelled = ord.status === 'cancelled';

                          return (
                            <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-semibold text-slate-900 block">{ord.date}</span>
                                <span className="text-[10px] text-slate-400 font-mono">#{ord.id.slice(-6)}</span>
                              </td>

                              <td className="py-3 px-4">
                                <span className="font-bold text-slate-900 block">{ord.itemTitle}</span>
                                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                                  <span>{ord.buyerName}</span>
                                  {ord.customerPhone && (
                                    <span className="text-slate-400">· {ord.customerPhone}</span>
                                  )}
                                  <span className="font-semibold text-slate-600">· Qty: {ord.quantity}</span>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-900 block">
                                    ${ord.salePrice.toFixed(2)}
                                  </span>
                                  {hasUpsell ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                      +${(ord.salePrice - basePr).toFixed(2)} upsell
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">
                                      Base: ${basePr.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="space-y-0.5">
                                  <span className={`font-black text-sm block ${isCancelled ? 'text-slate-400 line-through' : 'text-blue-700'}`}>
                                    ${(ord.memberReward || 0).toFixed(2)}
                                  </span>
                                  {!isCancelled && (
                                    <span className="text-[10px] text-slate-500 block">
                                      {ord.rewardCalculationMode === 'per_item' ? (
                                        <span className="text-indigo-600 font-bold">Per Item (×{ord.quantity})</span>
                                      ) : (
                                        <span>Per Order (flat)</span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize border ${
                                    ord.status === 'delivered' || ord.status === 'completed'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : ord.status === 'confirmed' || ord.status === 'shipped'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : ord.status === 'cancelled'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}
                                >
                                  {ord.status}
                                </span>
                              </td>

                              <td className="py-3 px-4 text-center">
                                {isCancelled ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                    Cancelled ($0)
                                  </span>
                                ) : isGranted ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Granted</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>Pending</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => {
                                    onClose();
                                    onOpenEditOrder(ord);
                                  }}
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded cursor-pointer"
                                >
                                  Edit Order
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Payouts Tab */
            <div className="space-y-3">
              {memberPayouts.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                  <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No payouts recorded yet</p>
                  {onPayMember && (
                    <button
                      onClick={() => onPayMember(member, stats.unpaidBalance)}
                      className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs"
                    >
                      Record First Payout
                    </button>
                  )}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4">Notes / Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberPayouts.map((pay) => (
                        <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {pay.date}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                            ${pay.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-xs">
                              {pay.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {pay.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {activeTab === 'orders' ? `${filteredOrders.length} orders` : `${memberPayouts.length} payouts`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
