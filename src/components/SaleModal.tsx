import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ShoppingBag, 
  Check, 
  AlertCircle, 
  MapPin, 
  Banknote, 
  Phone, 
  User, 
  Package, 
  Award, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Sparkles,
  RefreshCw,
  Layers
} from 'lucide-react';
import { Order, InventoryItem, OrderStatus, ConfirmationMember, RewardCalculationMode, calculateMemberReward } from '../types';
import { saveOrder, deductInventoryStockFifo } from '../services/db';
import { useAuth } from '../context/AuthContext';

interface SaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  teamMembers?: ConfirmationMember[];
  editingOrder?: Order | null;
  initialItem?: InventoryItem | null;
  onOrderSaved?: (savedOrder: Order) => void;
  onItemUpdated?: (updatedItem: InventoryItem) => void;
}

export const SaleModal: React.FC<SaleModalProps> = ({
  isOpen,
  onClose,
  inventory,
  teamMembers = [],
  editingOrder,
  initialItem,
  onOrderSaved,
  onItemUpdated,
}) => {
  const { user, profile, canViewFinancials } = useAuth();

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [isCustomItem, setIsCustomItem] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [platformFee, setPlatformFee] = useState<number>(0);
  const [buyerName, setBuyerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [status, setStatus] = useState<OrderStatus>('new');
  const [deliveredDate, setDeliveredDate] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Confirmation Team & Reward State
  const [confirmationMemberId, setConfirmationMemberId] = useState<string>('');
  const [memberReward, setMemberReward] = useState<number>(0);
  const [rewardCalculationMode, setRewardCalculationMode] = useState<RewardCalculationMode>('per_order');
  const [isCustomReward, setIsCustomReward] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected confirmation team member object
  const selectedMember = useMemo(() => {
    return teamMembers.find((m) => m.id === confirmationMemberId);
  }, [teamMembers, confirmationMemberId]);

  // Sync state on open / change
  useEffect(() => {
    if (editingOrder) {
      if (editingOrder.itemId && inventory.some((i) => i.id === editingOrder.itemId)) {
        setSelectedItemId(editingOrder.itemId);
        setIsCustomItem(false);
      } else {
        setSelectedItemId('custom');
        setIsCustomItem(true);
      }
      setItemTitle(editingOrder.itemTitle);
      setQuantity(editingOrder.quantity);
      setSalePrice(editingOrder.salePrice);
      setBasePrice(typeof editingOrder.basePrice === 'number' ? editingOrder.basePrice : editingOrder.salePrice);
      setUnitCost(editingOrder.unitCost);
      setPlatformFee(editingOrder.platformFee || 0);
      setBuyerName(editingOrder.buyerName || '');
      setCustomerPhone(editingOrder.customerPhone || '');
      setCustomerAddress(editingOrder.customerAddress || '');
      setGoogleMapsUrl(editingOrder.googleMapsUrl || '');
      setStatus(editingOrder.status || 'new');
      setDeliveredDate(editingOrder.deliveredDate || (editingOrder.status === 'delivered' ? (editingOrder.date || new Date().toISOString().slice(0, 10)) : ''));
      setNotes(editingOrder.notes || '');

      setConfirmationMemberId(editingOrder.confirmationMemberId || '');
      setMemberReward(editingOrder.memberReward || 0);
      setRewardCalculationMode(editingOrder.rewardCalculationMode || 'per_order');
      setIsCustomReward(true);
    } else if (initialItem) {
      setSelectedItemId(initialItem.id);
      setIsCustomItem(false);
      setItemTitle(initialItem.title);
      setQuantity(1);
      setSalePrice(initialItem.sellingPrice);
      setBasePrice(initialItem.sellingPrice);
      setUnitCost(initialItem.costPrice);
      setPlatformFee(0);
      setBuyerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setGoogleMapsUrl('');
      setStatus('new');
      setNotes('');
      setConfirmationMemberId('');
      setMemberReward(0);
      setRewardCalculationMode('per_order');
      setIsCustomReward(false);
    } else {
      if (inventory.length > 0) {
        const first = inventory[0];
        setSelectedItemId(first.id);
        setIsCustomItem(false);
        setItemTitle(first.title);
        setSalePrice(first.sellingPrice);
        setBasePrice(first.sellingPrice);
        setUnitCost(first.costPrice);
      } else {
        setSelectedItemId('custom');
        setIsCustomItem(true);
        setItemTitle('');
        setSalePrice(0);
        setBasePrice(0);
        setUnitCost(0);
      }
      setQuantity(1);
      setPlatformFee(0);
      setBuyerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setGoogleMapsUrl('');
      setStatus('new');
      setNotes('');
      setConfirmationMemberId('');
      setMemberReward(0);
      setRewardCalculationMode('per_order');
      setIsCustomReward(false);
    }
  }, [editingOrder, initialItem, isOpen, inventory]);

  // When selecting an item from inventory
  const handleItemSelect = (id: string) => {
    setSelectedItemId(id);
    if (id === 'custom') {
      setIsCustomItem(true);
      setItemTitle('');
      setSalePrice(0);
      setBasePrice(0);
      setUnitCost(0);
    } else {
      setIsCustomItem(false);
      const item = inventory.find((i) => i.id === id);
      if (item) {
        setItemTitle(item.title);
        setSalePrice(item.sellingPrice);
        setBasePrice(item.sellingPrice);
        setUnitCost(item.costPrice);
      }
    }
  };

  // Calculation of member reward and bonus based on calculation setting (per_order vs per_item)
  const rewardBreakdown = useMemo(() => {
    if (!selectedMember) {
      return { baseTotal: 0, upsellPerUnit: 0, bonusTotal: 0, totalReward: 0 };
    }
    return calculateMemberReward(
      selectedMember.baseReward || 0,
      basePrice || salePrice,
      salePrice,
      quantity,
      rewardCalculationMode
    );
  }, [selectedMember, basePrice, salePrice, quantity, rewardCalculationMode]);

  const calculatedReward = rewardBreakdown.totalReward;

  // Auto update reward if not manually overridden
  useEffect(() => {
    if (!isCustomReward && confirmationMemberId && selectedMember) {
      setMemberReward(calculatedReward);
    }
  }, [isCustomReward, confirmationMemberId, selectedMember, calculatedReward]);

  const handleMemberChange = (memberId: string) => {
    setConfirmationMemberId(memberId);
    setIsCustomReward(false);
    if (!memberId) {
      setMemberReward(0);
    } else {
      const mem = teamMembers.find((m) => m.id === memberId);
      if (mem) {
        const mode = mem.rewardCalculationMode || 'per_order';
        setRewardCalculationMode(mode);
        const res = calculateMemberReward(
          mem.baseReward || 0,
          basePrice || salePrice,
          salePrice,
          quantity,
          mode
        );
        setMemberReward(res.totalReward);
      }
    }
  };

  // Real-time financial figures (accounting for member reward deduction from net profit)
  const totalRevenue = useMemo(() => {
    return Number((salePrice * quantity).toFixed(2));
  }, [salePrice, quantity]);

  const totalCost = useMemo(() => {
    return Number((unitCost * quantity + (platformFee || 0)).toFixed(2));
  }, [unitCost, quantity, platformFee]);

  const activeRewardDeduction = useMemo(() => {
    return confirmationMemberId ? Number(memberReward) || 0 : 0;
  }, [confirmationMemberId, memberReward]);

  const netProfit = useMemo(() => {
    return Number((totalRevenue - totalCost - activeRewardDeduction).toFixed(2));
  }, [totalRevenue, totalCost, activeRewardDeduction]);

  const profitMargin = useMemo(() => {
    return totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;
  }, [totalRevenue, netProfit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) {
      setErrorMsg('Please select or specify an item title.');
      return;
    }
    if (quantity <= 0) {
      setErrorMsg('Quantity must be at least 1.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const autoDate = editingOrder?.date || new Date().toISOString().slice(0, 10);
    const itemIdToSave = isCustomItem || !selectedItemId || selectedItemId === 'custom' ? undefined : selectedItemId;

    // Calculate reward status
    let rewardStatus: 'pending' | 'granted' | 'cancelled' | undefined = undefined;
    if (confirmationMemberId && selectedMember) {
      if (status === 'cancelled') {
        rewardStatus = 'cancelled';
      } else if (selectedMember.rewardTrigger === 'confirmed') {
        rewardStatus = ['confirmed', 'delivered', 'shipped', 'completed', 'pending_pickup'].includes(status)
          ? 'granted'
          : 'pending';
      } else {
        rewardStatus = ['delivered', 'completed'].includes(status) ? 'granted' : 'pending';
      }
    }

    const isDeliveredStatus = status === 'delivered' || status === 'completed';
    const deliveredDateToSave = isDeliveredStatus
      ? (deliveredDate || editingOrder?.deliveredDate || new Date().toISOString().slice(0, 10))
      : undefined;

    const orderData = {
      itemId: itemIdToSave,
      itemTitle,
      quantity,
      unitCost,
      salePrice,
      shippingCharged: 0,
      shippingCost: 0,
      platformFee,
      totalRevenue,
      totalCost,
      netProfit,
      profitMargin,
      buyerName: buyerName.trim() || 'Facebook Customer',
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      googleMapsUrl: googleMapsUrl.trim() || undefined,
      paymentMethod: 'cash' as const,
      fulfillmentType: 'local_pickup' as const,
      status,
      date: autoDate,
      deliveredDate: deliveredDateToSave,
      notes: notes.trim() || undefined,
      createdAt: editingOrder?.createdAt || new Date().toISOString(),
      createdBy: user?.uid || profile?.uid,

      // Confirmation team fields
      confirmationMemberId: confirmationMemberId || undefined,
      confirmationMemberName: selectedMember ? selectedMember.name : undefined,
      basePrice: Number(basePrice) || salePrice,
      memberReward: confirmationMemberId ? Number(activeRewardDeduction) : 0,
      rewardTrigger: selectedMember ? selectedMember.rewardTrigger : undefined,
      rewardStatus,
      rewardCalculationMode: confirmationMemberId ? rewardCalculationMode : undefined,
    };

    try {
      const savedId = await saveOrder(orderData, editingOrder?.id);

      onOrderSaved?.({
        id: savedId,
        ...orderData,
      });

      // If creating a new order linked to an inventory item, auto-decrement stock using FIFO
      if (!editingOrder && itemIdToSave) {
        const matchedItem = inventory.find((i) => i.id === itemIdToSave);
        if (matchedItem) {
          const res = await deductInventoryStockFifo(itemIdToSave, matchedItem, quantity);
          if (res?.updatedItem) {
            onItemUpdated?.(res.updatedItem);
          }
        }
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                {editingOrder ? 'Edit Order Details' : 'Record New Order'}
              </h2>
              <p className="text-xs text-slate-500">
                Cash on delivery order details, customer info & agent reward
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Item Selection from Inventory + Quantity */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Item from Inventory *
                </label>
                <div className="relative">
                  <select
                    value={selectedItemId}
                    onChange={(e) => handleItemSelect(e.target.value)}
                    className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  >
                    {inventory.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.isBundle ? '🎁 [Bundle] ' : ''}{it.title} ({it.stock} in stock) — ${it.sellingPrice}
                      </option>
                    ))}
                    <option value="custom">-- Custom / Unlisted Item --</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Qty *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Custom Item Title */}
            {isCustomItem && (
              <div className="animate-in fade-in">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Custom Item Name / Description *
                </label>
                <input
                  type="text"
                  required
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="e.g. Sony Headphones or Vintage Lamp"
                  className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}
          </div>

          {/* Pricing Row: Sale Price & Base Catalog Price */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Sale Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={salePrice}
                onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                className="w-full text-xs sm:text-sm p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1" title="Catalog base price before agent upsell">
                Base Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                className="w-full text-xs sm:text-sm p-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700"
                placeholder="0"
              />
            </div>

            {canViewFinancials && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Unit Cost ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs sm:text-sm p-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Fee / Misc ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={platformFee}
                onChange={(e) => setPlatformFee(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full text-xs sm:text-sm p-2 bg-white border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* ==================== CONFIRMATION TEAM & REWARD FIELD ==================== */}
          <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 p-3.5 rounded-xl border border-blue-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-blue-600" />
                <span>Confirmed By (Confirmation Team Member)</span>
              </label>
              <span className="text-[11px] text-blue-700 font-semibold">Reward Tracking</span>
            </div>

            {/* Member Dropdown */}
            <div>
              <select
                value={confirmationMemberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">-- None / Direct Marketplace Sale (No Agent) --</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} (Base Reward: ${member.baseReward.toFixed(2)} · On {member.rewardTrigger === 'confirmed' ? 'Confirmed' : 'Delivered'})
                  </option>
                ))}
              </select>
            </div>

            {/* When a member is assigned: Display Reward & Upsell Calculation */}
            {selectedMember && (
              <div className="space-y-2.5 pt-1 animate-in fade-in">
                {/* Reward & Bonus Calculation Mode Setting */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Reward &amp; Bonus Setting:</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      quantity > 1 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {quantity > 1 ? `Multi-item order (${quantity} items)` : 'Single item'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRewardCalculationMode('per_order');
                        setIsCustomReward(false);
                      }}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        rewardCalculationMode === 'per_order'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Per Order (Flat)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRewardCalculationMode('per_item');
                        setIsCustomReward(false);
                      }}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        rewardCalculationMode === 'per_item'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Per Items ({quantity}×)</span>
                    </button>
                  </div>

                  {/* Calculation Breakdown Details */}
                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg space-y-1.5 border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">
                        Base reward {rewardCalculationMode === 'per_item' ? `($${selectedMember.baseReward.toFixed(2)} × ${quantity} items)` : '(flat per order)'}:
                      </span>
                      <span className="font-bold text-slate-800">${rewardBreakdown.baseTotal.toFixed(2)}</span>
                    </div>

                    {rewardBreakdown.bonusTotal > 0 ? (
                      <div className="flex justify-between items-center text-emerald-700">
                        <span>
                          Upsell bonus {rewardCalculationMode === 'per_item' ? `(+$${rewardBreakdown.upsellPerUnit.toFixed(2)} × ${quantity} items)` : `(+$${rewardBreakdown.upsellPerUnit.toFixed(2)} flat)`}:
                        </span>
                        <span className="font-bold">+${rewardBreakdown.bonusTotal.toFixed(2)}</span>
                      </div>
                    ) : salePrice < basePrice ? (
                      <div className="text-[10px] text-amber-700">
                        Sold below catalog price ($${basePrice.toFixed(2)}). Standard base reward applies without bonus.
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400">
                        Sold at catalog base price ($${basePrice.toFixed(2)}). No upsell bonus.
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 font-bold text-xs">
                      <span className="text-slate-700">Calculated Reward &amp; Bonus:</span>
                      <span className="text-blue-700 font-black text-sm">${rewardBreakdown.totalReward.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Member Reward Amount Input */}
                <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      Final Member Reward Amount ($)
                    </label>
                    <span className="text-[10px] text-slate-500 block">
                      Deducted from order net profit · {selectedMember.rewardTrigger === 'confirmed' ? '⚡ Granted on Confirmed' : '📦 Granted on Delivered'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={memberReward}
                        onChange={(e) => {
                          setMemberReward(parseFloat(e.target.value) || 0);
                          setIsCustomReward(true);
                        }}
                        className="w-full pl-6 pr-2 py-1.5 text-xs sm:text-sm font-black text-blue-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                      />
                    </div>

                    {isCustomReward && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomReward(false);
                          setMemberReward(calculatedReward);
                        }}
                        title="Reset to calculated formula"
                        className="p-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Notice: Cash on Delivery */}
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs">
            <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              Payment Method: <strong>Cash on Delivery (CoD)</strong>
            </span>
          </div>

          {/* Customer Details: Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. (555) 234-5678"
                className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
              />
            </div>
          </div>

          {/* Customer Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Customer Address / Delivery Location
            </label>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="e.g. 742 Evergreen Terrace, Springfield"
              className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
            />
          </div>

          {/* Google Maps Link Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Google Map Link (Optional)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Location pin / URL</span>
            </label>
            <input
              type="url"
              value={googleMapsUrl}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
              placeholder="e.g. https://maps.app.goo.gl/... or https://maps.google.com/?q=..."
              className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Order Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                const nextStatus = e.target.value as OrderStatus;
                setStatus(nextStatus);
                if ((nextStatus === 'delivered' || nextStatus === 'completed') && !deliveredDate) {
                  setDeliveredDate(new Date().toISOString().slice(0, 10));
                }
              }}
              className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
            >
              <option value="new">New (Needs Confirmation)</option>
              <option value="confirmed">Confirmed (Ready to Deliver)</option>
              <option value="delivered">Delivered (Completed)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Delivery Date for Profit Attribution when Delivered */}
          {(status === 'delivered' || status === 'completed') && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 animate-in fade-in">
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Delivered Date (Profit Date)
              </label>
              <input
                type="date"
                value={deliveredDate || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDeliveredDate(e.target.value)}
                className="w-full text-xs sm:text-sm p-2 bg-white border border-emerald-300 rounded-lg text-slate-900 focus:outline-hidden font-medium"
              />
              <p className="text-[11px] text-emerald-700 mt-1">
                Profit will appear under this date (e.g. delivered today for an order created yesterday).
              </p>
            </div>
          )}

          {/* Notes / Meetup Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notes / Delivery Details
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Deliver between 3-5 PM, call upon arrival, cash on hand."
              className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-hidden"
            />
          </div>

          {/* Real-Time Live Margin Calculation Bar with Member Reward deduction */}
          {canViewFinancials && (
            <div className="p-3 bg-slate-900 text-white rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Total Due
                  </span>
                  <span className="text-sm sm:text-base font-black text-blue-300">
                    ${totalRevenue.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Cost & Fees
                  </span>
                  <span className="text-sm sm:text-base font-black text-rose-300">
                    ${totalCost.toFixed(2)}
                  </span>
                </div>

                {confirmationMemberId && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Agent Reward
                    </span>
                    <span className="text-sm sm:text-base font-black text-amber-300">
                      -${activeRewardDeduction.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Net Profit
                  </span>
                  <span
                    className={`text-sm sm:text-base font-black ${
                      netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {netProfit >= 0 ? `+$${netProfit.toFixed(2)}` : `-$${Math.abs(netProfit).toFixed(2)}`}
                  </span>
                  <span className="text-[10px] text-slate-300 block font-semibold">
                    {profitMargin}% margin
                  </span>
                </div>
              </div>

              {confirmationMemberId && (
                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 flex items-center justify-between">
                  <span>Deduction: Product cost + Member reward deducted from net profit.</span>
                  <span className="text-blue-300 font-semibold">{selectedMember?.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : editingOrder
                  ? 'Update Order'
                  : 'Save Order'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
